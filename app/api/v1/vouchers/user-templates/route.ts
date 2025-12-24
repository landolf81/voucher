import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    console.log('사용자별 템플릿 목록 API 호출:', { userId });

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'USER_ID_REQUIRED' 
      }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 사용자가 사용등록한 교환권의 템플릿 ID들 조회
    const { data: vouchers, error: vouchersError } = await supabase
      .from('vouchers')
      .select('template_id')
      .eq('used_by_user_id', userId)
      .eq('status', 'used')
      .not('used_at', 'is', null)
      .not('template_id', 'is', null);

    if (vouchersError) {
      console.error('교환권 조회 오류:', vouchersError);
      return NextResponse.json({ 
        success: false, 
        error: 'VOUCHERS_QUERY_ERROR' 
      }, { status: 500 });
    }

    // 중복 제거된 템플릿 ID 목록
    const templateIds = [...new Set(vouchers?.map(v => v.template_id).filter(id => id) || [])];

    if (templateIds.length === 0) {
      return NextResponse.json({ 
        success: true, 
        data: [] 
      });
    }

    // 템플릿 정보 조회
    const { data: templates, error: templatesError } = await supabase
      .from('voucher_templates')
      .select('id, voucher_name, voucher_type')
      .in('id', templateIds)
      .order('voucher_name', { ascending: true });

    if (templatesError) {
      console.error('템플릿 조회 오류:', templatesError);
      return NextResponse.json({ 
        success: false, 
        error: 'TEMPLATES_QUERY_ERROR' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: templates || []
    });

  } catch (error) {
    console.error('사용자별 템플릿 목록 API 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'INTERNAL_ERROR' 
    }, { status: 500 });
  }
}