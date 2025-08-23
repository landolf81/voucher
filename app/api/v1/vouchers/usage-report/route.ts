import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const templateId = searchParams.get('template_id'); // 템플릿 필터링 추가
    const siteId = searchParams.get('site_id'); // 사용처 필터링 추가

    console.log('사용등록 리포트 API 호출:', { userId, startDate, endDate, templateId, siteId });

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

    // 먼저 사용자 정보와 소속 사업장 조회
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('site_id, role')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      console.error('사용자 프로필 조회 오류:', userError);
      return NextResponse.json({ 
        success: false, 
        error: 'USER_PROFILE_ERROR' 
      }, { status: 500 });
    }

    if (!userProfile) {
      return NextResponse.json({ 
        success: false, 
        error: 'USER_NOT_FOUND' 
      }, { status: 404 });
    }

    // 사용등록된 교환권 조회 (사용처 기준)
    let query = supabase
      .from('vouchers')
      .select(`
        id,
        serial_no,
        amount,
        association,
        name,
        status,
        used_at,
        issued_at,
        template_id,
        used_at_site_id,
        used_by_user_id
      `)
      .eq('status', 'used')
      .not('used_at', 'is', null)
      .order('used_at', { ascending: false });

    // 사용처 필터링 (관리자는 선택 가능, 일반 사용자는 소속 사업장만)
    if (siteId && siteId !== 'all') {
      // 특정 사용처 선택됨
      query = query.eq('used_at_site_id', siteId);
    } else if (userProfile.role !== 'admin') {
      // 일반 사용자는 소속 사업장만 조회
      if (userProfile.site_id) {
        query = query.eq('used_at_site_id', userProfile.site_id);
      } else {
        // 소속 사업장이 없으면 빈 결과 반환
        return NextResponse.json({ 
          success: true, 
          data: {
            summary: { totalCount: 0, totalAmount: 0, dateRange: { start: startDate, end: endDate } },
            byDate: [],
            byTemplate: [],
            vouchers: []
          }
        });
      }
    }

    // 날짜 범위 필터링
    if (startDate) {
      query = query.gte('used_at', `${startDate}T00:00:00`);
    }
    if (endDate) {
      query = query.lte('used_at', `${endDate}T23:59:59`);
    }
    
    // 템플릿 필터링
    if (templateId && templateId !== 'all') {
      query = query.eq('template_id', templateId);
    }

    const { data: vouchers, error } = await query;

    if (error) {
      console.error('사용등록 리포트 조회 오류:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'QUERY_ERROR' 
      }, { status: 500 });
    }

    if (!vouchers || vouchers.length === 0) {
      return NextResponse.json({ 
        success: true, 
        data: {
          summary: {
            totalCount: 0,
            totalAmount: 0,
            dateRange: { start: startDate, end: endDate }
          },
          byDate: [],
          byTemplate: [],
          vouchers: []
        }
      });
    }

    // 템플릿 정보 조회
    const templateIds = [...new Set(vouchers.map(v => v.template_id).filter(id => id))];
    const templatesPromise = templateIds.length > 0 ? 
      supabase
        .from('voucher_templates')
        .select('id, voucher_name, voucher_type')
        .in('id', templateIds) : 
      Promise.resolve({ data: [], error: null });

    // 사용처 정보 조회
    const siteIds = [...new Set(vouchers.map(v => v.used_at_site_id).filter(id => id))];
    const sitesPromise = siteIds.length > 0 ? 
      supabase
        .from('sites')
        .select('id, site_name')
        .in('id', siteIds) : 
      Promise.resolve({ data: [], error: null });

    const [{ data: templates }, { data: sites }] = await Promise.all([
      templatesPromise,
      sitesPromise
    ]);

    const templateMap = new Map(templates?.map(t => [t.id, t]) || []);
    const siteMap = new Map(sites?.map(s => [s.id, s.site_name]) || []);

    // 데이터 가공
    const enrichedVouchers = vouchers.map(voucher => ({
      ...voucher,
      template_info: voucher.template_id ? templateMap.get(voucher.template_id) : null,
      site_name: voucher.used_at_site_id ? siteMap.get(voucher.used_at_site_id) : null,
      used_date: voucher.used_at ? new Date(voucher.used_at).toISOString().split('T')[0] : null,
      issued_date: voucher.issued_at ? new Date(voucher.issued_at).toISOString().split('T')[0] : null
    }));

    // 일자별 통계
    const byDate = enrichedVouchers.reduce((acc, voucher) => {
      const date = voucher.used_date;
      if (!date) return acc;
      
      if (!acc[date]) {
        acc[date] = { date, count: 0, amount: 0 };
      }
      acc[date].count++;
      acc[date].amount += Number(voucher.amount);
      return acc;
    }, {} as Record<string, { date: string; count: number; amount: number }>);

    // 템플릿별 통계
    const byTemplate = enrichedVouchers.reduce((acc, voucher) => {
      const templateId = voucher.template_id || 'unknown';
      const templateInfo = voucher.template_info;
      
      if (!acc[templateId]) {
        acc[templateId] = { 
          template_id: templateId,
          template_name: templateInfo?.voucher_name || '알 수 없음',
          template_type: templateInfo?.voucher_type || '',
          count: 0, 
          amount: 0 
        };
      }
      acc[templateId].count++;
      acc[templateId].amount += Number(voucher.amount);
      return acc;
    }, {} as Record<string, { template_id: string; template_name: string; template_type: string; count: number; amount: number }>);

    // 전체 통계
    const summary = {
      totalCount: enrichedVouchers.length,
      totalAmount: enrichedVouchers.reduce((sum, v) => sum + Number(v.amount), 0),
      dateRange: { 
        start: startDate || (enrichedVouchers.length > 0 ? enrichedVouchers[enrichedVouchers.length - 1].used_date : null),
        end: endDate || (enrichedVouchers.length > 0 ? enrichedVouchers[0].used_date : null)
      }
    };

    return NextResponse.json({
      success: true,
      data: {
        summary,
        byDate: Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date)),
        byTemplate: Object.values(byTemplate).sort((a, b) => b.count - a.count),
        vouchers: enrichedVouchers
      }
    });

  } catch (error) {
    console.error('사용등록 리포트 API 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'INTERNAL_ERROR' 
    }, { status: 500 });
  }
}