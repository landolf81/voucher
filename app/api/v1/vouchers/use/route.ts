import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest){
  const body = await req.json().catch(()=>({}));
  const serial = String(body.serial_no || "");
  if (!serial) return NextResponse.json({ ok:false, error:"SERIAL_REQUIRED" }, { status:400 });

  const supabase = supabaseServer();
  
  // 먼저 교환권 정보 조회 (SMS 발송용)
  const { data: voucherInfo, error: fetchError } = await supabase
    .from('vouchers')
    .select('id, phone, name, amount, association, template_id')
    .eq('serial_no', serial)
    .single();

  const { data, error } = await supabase.rpc("use_voucher_by_serial", { p_serial: serial });
  if (error) return NextResponse.json({ ok:false, error:error.message }, { status:500 });
  if (!data) return NextResponse.json({ ok:false, error:"NOT_FOUND_OR_ALREADY_USED" }, { status:409 });

  // SMS 알림 발송 (전화번호가 있는 경우)
  if (voucherInfo && voucherInfo.phone) {
    try {
      // 템플릿 정보 조회
      let templateName = '교환권';
      if (voucherInfo.template_id) {
        try {
          const { data: templateData } = await supabase
            .from('voucher_templates')
            .select('voucher_name')
            .eq('id', voucherInfo.template_id)
            .single();
          if (templateData) {
            templateName = templateData.voucher_name;
          }
        } catch (templateError) {
          console.warn('템플릿 정보 조회 실패, 기본값 사용:', templateError);
        }
      }

      const smsResponse = await fetch(new URL('/api/notifications/send-sms', req.url).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: voucherInfo.phone,
          message: `[교환권 사용] ${voucherInfo.name || '회원'}님의 "${templateName}" ${new Date().toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}에 사용되었습니다. 금액: ${voucherInfo.amount.toLocaleString()}원`,
          messageType: 'voucher_used',
          voucherId: voucherInfo.id,
          recipientName: voucherInfo.name
        })
      });

      if (smsResponse.ok) {
        const responseText = await smsResponse.text();
        try {
          const smsResult = JSON.parse(responseText);
          console.log(`SMS 발송 성공 (${serial}):`, smsResult);
        } catch (parseError) {
          console.error(`SMS 응답 파싱 오류 (${serial}):`, responseText);
        }
      } else {
        const errorText = await smsResponse.text();
        console.warn(`SMS 발송 실패 (${serial}): ${smsResponse.status} - ${errorText}`);
      }
    } catch (smsError) {
      console.error(`SMS 발송 오류 (${serial}):`, smsError);
    }
  }

  return NextResponse.json({ ok:true, used:data });
}
