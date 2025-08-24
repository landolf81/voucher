import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { verify as verifyHmac, verifyLegacy } from "@/lib/hmac";

export const runtime = "nodejs";

function parsePayload(p: string){
  if (!p?.startsWith?.("VCH:")) return { serial: p, ts: null, sig: null, issuedDate: null };
  const parts = Object.fromEntries(p.split("|").map(kv => kv.split(":") as [string,string]));
  return { 
    serial: parts["VCH"], 
    ts: parts["TS"], 
    sig: parts["SIG"],
    issuedDate: parts["ISSUED"] || null // 발행일자 추가
  };
}

export async function POST(req: NextRequest){
  try {
    const body = await req.json().catch(()=>({}));
    const payload = String(body.payload || "");
    console.log('Verify API 호출:', { payload });
    
    const { serial, ts, sig, issuedDate } = parsePayload(payload);
    if (!serial) return NextResponse.json({ ok:false, error:"INVALID_PAYLOAD" }, { status:400 });

    // HMAC 서명 검증 (발행일자 포함된 새 형식과 레거시 형식 모두 지원)
    if (ts && sig) {
      let isValidSignature = false;
      
      if (issuedDate) {
        // 새 형식: 발행일자 포함된 서명 검증
        isValidSignature = verifyHmac(serial, issuedDate, ts, sig);
      } else {
        // 레거시 형식: 발행일자 없는 서명 검증
        isValidSignature = verifyLegacy(serial, ts, sig);
      }
      
      if (!isValidSignature) {
        return NextResponse.json({ ok:false, error:"INVALID_SIGNATURE" }, { status:400 });
      }
    }

    const supabase = supabaseServer();
    
    console.log('교환권 조회 시작:', serial);
    
    // 동일 일련번호의 모든 교환권 조회 (최신 발행일자 확인을 위해)
    const { data: vouchers, error } = await supabase
      .from("vouchers")
      .select("serial_no, amount, association, name, dob, status, used_at, used_at_site_id, issued_at, template_id")
      .eq("serial_no", serial)
      .order('issued_at', { ascending: false }); // 발행일자 내림차순

    if (error) {
      console.error('교환권 조회 오류:', error);
      return NextResponse.json({ ok:false, error:error.message }, { status:500 });
    }
    if (!vouchers || vouchers.length === 0) {
      console.log('교환권 찾을 수 없음:', serial);
      return NextResponse.json({ ok:false, error:"NOT_FOUND" }, { status:404 });
    }

    // 최신 발행일자의 교환권 선택
    const latestVoucher = vouchers[0];
    const voucher = latestVoucher;

    // 발행일자 비교 정보 준비
    let dateComparison = null;
    if (voucher.issued_at) {
      const dbIssuedDate = new Date(voucher.issued_at).toISOString().slice(0,10).replace(/-/g,""); // YYYYMMDD
      const dbIssuedDateFormatted = new Date(voucher.issued_at).toLocaleDateString('ko-KR');
      
      if (issuedDate) {
        // QR코드에 발행일자가 포함된 경우
        const qrIssuedDateFormatted = `${issuedDate.slice(0,4)}-${issuedDate.slice(4,6)}-${issuedDate.slice(6,8)}`;
        const qrDateObj = new Date(qrIssuedDateFormatted);
        const qrIssuedDateKo = qrDateObj.toLocaleDateString('ko-KR');
        
        dateComparison = {
          qr_issued_date: issuedDate,
          db_issued_date: dbIssuedDate,
          qr_issued_date_formatted: qrIssuedDateKo,
          db_issued_date_formatted: dbIssuedDateFormatted,
          is_match: issuedDate === dbIssuedDate,
          message: issuedDate === dbIssuedDate 
            ? "발행일자가 일치합니다." 
            : `발행일자가 다릅니다. QR코드: ${qrIssuedDateKo}, 데이터베이스: ${dbIssuedDateFormatted}`
        };
        
        // 발행일자 불일치 시 에러 반환 - 단, 오늘 날짜인 경우는 허용 (발행 당일 동기화 이슈 대응)
        const todayStr = new Date().toISOString().slice(0,10).replace(/-/g,""); // YYYYMMDD
        const isToday = issuedDate === todayStr || dbIssuedDate === todayStr;
        
        if (issuedDate !== dbIssuedDate && !isToday) {
          console.log('발행일자 불일치 (과거 날짜):', { qrIssued: issuedDate, dbIssued: dbIssuedDate, today: todayStr });
          return NextResponse.json({ 
            ok: false, 
            error: "ISSUED_DATE_MISMATCH",
            message: "이전에 발행된 교환권입니다. 최신 교환권을 사용해주세요.",
            date_comparison: dateComparison
          }, { status: 400 });
        } else if (issuedDate !== dbIssuedDate && isToday) {
          console.log('발행일자 불일치 (오늘 날짜) - 허용:', { qrIssued: issuedDate, dbIssued: dbIssuedDate, today: todayStr });
          // 오늘 날짜인 경우는 동기화 이슈로 간주하여 허용
        }
      } else {
        // QR코드에 발행일자가 없는 경우 (레거시)
        dateComparison = {
          qr_issued_date: null,
          db_issued_date: dbIssuedDate,
          qr_issued_date_formatted: "QR코드에 발행일자 없음",
          db_issued_date_formatted: dbIssuedDateFormatted,
          is_match: null,
          message: `데이터베이스 발행일자: ${dbIssuedDateFormatted} (QR코드는 구형식)`
        };
      }
    }

    console.log('교환권 조회 성공:', voucher);

    // 사용처 정보 조회 (used_at_site_id → site_name)
    let usage_location = null;
    if (voucher.used_at_site_id) {
      console.log('사용처 정보 조회:', voucher.used_at_site_id);
      const { data: site } = await supabase
        .from("sites")
        .select("site_name")
        .eq("id", voucher.used_at_site_id)
        .maybeSingle();
      
      if (site) {
        console.log('사용처 정보 조회 성공:', site);
        usage_location = site.site_name;
      }
    }

    // 템플릿 정보 추가 조회
    let voucherWithTemplate = {
      ...voucher,
      usage_location  // used_at_site_id를 usage_location으로 변환
    };
    
    if (voucher.template_id) {
      console.log('템플릿 정보 조회:', voucher.template_id);
      const { data: template } = await supabase
        .from("voucher_templates")
        .select("voucher_name, voucher_type")
        .eq("id", voucher.template_id)
        .maybeSingle();
      
      if (template) {
        console.log('템플릿 정보 조회 성공:', template);
        voucherWithTemplate = {
          ...voucherWithTemplate,
          voucher_templates: template
        } as any;
      }
    }

    console.log('최종 응답:', voucherWithTemplate);
    return NextResponse.json({ 
      ok: true, 
      voucher: voucherWithTemplate,
      date_comparison: dateComparison 
    });
  } catch (error) {
    console.error('Verify API 전체 오류:', error);
    return NextResponse.json({ ok:false, error: 'INTERNAL_ERROR' }, { status:500 });
  }
}
