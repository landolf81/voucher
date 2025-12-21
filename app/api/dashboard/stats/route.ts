import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase Admin 클라이언트 싱글톤
let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabaseAdminInstance;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // 병렬로 모든 통계 조회
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalVouchersResult,
      usedVouchersResult,
      unusedVouchersResult,
      sitesResult,
      todayIssuedResult,
      authUsersResult
    ] = await Promise.all([
      supabase.from('vouchers').select('*', { count: 'exact', head: true }),
      supabase.from('vouchers').select('*', { count: 'exact', head: true }).eq('status', 'used'),
      supabase.from('vouchers').select('*', { count: 'exact', head: true }).eq('status', 'issued'),
      supabase.from('sites').select('*', { count: 'exact', head: true }),
      supabase.from('vouchers').select('*', { count: 'exact', head: true }).gte('issued_at', today.toISOString()),
      supabase.auth.admin.listUsers()
    ]);

    // 활성 사용자 수 (user_metadata.is_active가 false가 아닌 사용자)
    const totalUsers = authUsersResult.data?.users.filter(u => {
      const metadata = u.user_metadata;
      return metadata?.display_name && metadata?.is_active !== false;
    }).length || 0;

    const totalVouchers = totalVouchersResult.count || 0;
    const usedVouchers = usedVouchersResult.count || 0;

    // 사용률 계산
    const usageRate = totalVouchers > 0
      ? Math.round(usedVouchers / totalVouchers * 100)
      : 0;

    return NextResponse.json({
      ok: true,
      data: {
        totalVouchers,
        usedVouchers,
        unusedVouchers: unusedVouchersResult.count || 0,
        totalSites: sitesResult.count || 0,
        totalUsers,
        todayIssued: todayIssuedResult.count || 0,
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
