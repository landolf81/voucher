import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { searchTerm, searchType } = body;
    
    console.log('Search API 호출:', { searchTerm, searchType });
    
    if (!searchTerm?.trim()) {
      return NextResponse.json({ 
        ok: false, 
        error: "MISSING_SEARCH_TERM",
        message: "검색어를 입력해주세요."
      }, { status: 400 });
    }

    if (!searchType || !['serial', 'name', 'association', 'user_id'].includes(searchType)) {
      return NextResponse.json({ 
        ok: false, 
        error: "INVALID_SEARCH_TYPE",
        message: "올바른 검색 타입을 선택해주세요."
      }, { status: 400 });
    }

    const supabase = supabaseServer();
    const trimmedTerm = searchTerm.trim();
    
    let query = supabase
      .from("vouchers")
      .select(`
        id,
        serial_no, 
        amount, 
        association, 
        name, 
        dob, 
        status, 
        used_at, 
        used_at_site_id, 
        issued_at, 
        template_id,
        voucher_templates!inner(voucher_name, voucher_type)
      `)
      .order('issued_at', { ascending: false })
      .limit(20); // 최대 20개 결과 제한

    // 검색 타입별 쿼리 조건 설정
    switch (searchType) {
      case 'serial':
        query = query.ilike('serial_no', `%${trimmedTerm}%`);
        break;
      case 'name':
        query = query.ilike('name', `%${trimmedTerm}%`);
        break;
      case 'association':
        query = query.ilike('association', `%${trimmedTerm}%`);
        break;
      case 'user_id':
        // user_id로 검색하는 경우, user_profiles를 통해 해당 사용자의 교환권들을 찾음
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('name')
          .eq('user_id', trimmedTerm)
          .maybeSingle();
        
        if (!userProfile) {
          return NextResponse.json({ 
            ok: false, 
            error: "USER_NOT_FOUND",
            message: "해당 사용자 ID를 찾을 수 없습니다."
          }, { status: 404 });
        }
        
        // 사용자 이름으로 교환권 검색
        query = query.eq('name', userProfile.name);
        break;
    }

    console.log('교환권 검색 시작:', { searchType, searchTerm: trimmedTerm });
    
    const { data: vouchers, error } = await query;

    if (error) {
      console.error('교환권 검색 오류:', error);
      return NextResponse.json({ 
        ok: false, 
        error: error.message 
      }, { status: 500 });
    }

    if (!vouchers || vouchers.length === 0) {
      console.log('검색 결과 없음:', { searchType, searchTerm: trimmedTerm });
      return NextResponse.json({ 
        ok: false, 
        error: "NOT_FOUND",
        message: "검색 결과가 없습니다."
      }, { status: 404 });
    }

    console.log(`검색 결과 ${vouchers.length}개 찾음`);

    // 사용처 정보 조회 및 변환
    const vouchersWithLocation = await Promise.all(
      vouchers.map(async (voucher) => {
        let usage_location = null;
        
        if (voucher.used_at_site_id) {
          const { data: site } = await supabase
            .from("sites")
            .select("site_name")
            .eq("id", voucher.used_at_site_id)
            .maybeSingle();
          
          if (site) {
            usage_location = site.site_name;
          }
        }

        // voucher_templates 정보 포함하여 반환
        return {
          id: voucher.id,
          serial_no: voucher.serial_no,
          amount: voucher.amount,
          association: voucher.association,
          name: voucher.name,
          status: voucher.status,
          issued_at: voucher.issued_at,
          used_at: voucher.used_at,
          usage_location,
          voucher_templates: voucher.voucher_templates
        };
      })
    );

    console.log('최종 검색 결과:', vouchersWithLocation.length);
    
    return NextResponse.json({ 
      ok: true, 
      vouchers: vouchersWithLocation,
      total: vouchersWithLocation.length,
      searchType,
      searchTerm: trimmedTerm
    });

  } catch (error) {
    console.error('Search API 전체 오류:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'INTERNAL_ERROR',
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}