import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 발급된 교환권 총 개수 (모든 상태의 교환권)
    const { count: totalVouchers, error: voucherError } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true });

    if (voucherError) {
      console.error('교환권 총 개수 조회 오류:', voucherError);
    }

    // 사용된 교환권 개수
    const { count: usedVouchers, error: usedError } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'used');

    if (usedError) {
      console.error('사용된 교환권 조회 오류:', usedError);
    }

    // 등록된 사업장 개수
    const { count: totalSites, error: siteError } = await supabase
      .from('sites')
      .select('*', { count: 'exact', head: true });

    if (siteError) {
      console.error('사업장 조회 오류:', siteError);
    }

    // 활성 사용자 수 (user_profiles 테이블)
    const { count: totalUsers, error: userError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    if (userError) {
      console.error('사용자 조회 오류:', userError);
    }

    // 추가 통계: 오늘 발급된 교환권
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayIssued, error: todayError } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true })
      .gte('issued_at', today.toISOString());

    if (todayError) {
      console.error('오늘 발급된 교환권 조회 오류:', todayError);
    }

    // 추가 통계: 미사용 교환권
    const { count: unusedVouchers, error: unusedError } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'issued');

    if (unusedError) {
      console.error('미사용 교환권 조회 오류:', unusedError);
    }

    // 사용률 계산
    const usageRate = totalVouchers && totalVouchers > 0
      ? Math.round((usedVouchers || 0) / totalVouchers * 100)
      : 0;

    return NextResponse.json({
      ok: true,
      data: {
        totalVouchers: totalVouchers || 0,
        usedVouchers: usedVouchers || 0,
        unusedVouchers: unusedVouchers || 0,
        totalSites: totalSites || 0,
        totalUsers: totalUsers || 0,
        todayIssued: todayIssued || 0,
        usageRate
      }
    });

  } catch (error) {
    console.error('대시보드 통계 조회 오류:', error);
    return NextResponse.json(
      {
        ok: false,
        message: '통계 조회에 실패했습니다.',
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}