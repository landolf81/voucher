import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hasCompleteProfile, getAuthz } from '@/lib/types/auth';

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

    // auth.users에서 모든 사용자 조회
    const [authUsersResult, sitesResult] = await Promise.all([
      supabase.auth.admin.listUsers(),
      supabase.from('sites').select('id, site_name')
    ]);

    if (authUsersResult.error) {
      console.error('OAuth 계정 조회 오류:', authUsersResult.error);
      return NextResponse.json(
        { success: false, message: 'OAuth 계정 정보를 불러오는데 실패했습니다.' },
        { status: 500 }
      );
    }

    const siteMap = new Map((sitesResult.data || []).map((s: { id: string; site_name: string }) => [s.id, s.site_name]));

    // 모든 사용자 변환 (불완전한 metadata도 포함)
    const accounts = authUsersResult.data.users
      .map(authUser => {
        const metadata = authUser.user_metadata || {};
        const authz = getAuthz(authUser);
        return {
          id: authUser.id,
          name: metadata.name || authUser.email?.split('@')[0] || '미설정',
          email: authUser.email,
          phone: authUser.phone,
          role: authz?.role || 'viewer',
          oauth_provider: metadata.oauth_provider,
          oauth_provider_id: metadata.oauth_provider_id,
          oauth_linked_at: metadata.oauth_linked_at,
          is_active: authz?.is_active !== false,
          site_name: authz?.site_id ? siteMap.get(authz.site_id) : null,
          created_at: authUser.created_at,
          has_complete_profile: hasCompleteProfile(authUser)
        };
      })
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return NextResponse.json({
      success: true,
      accounts,
      total: accounts.length,
      oauth_count: accounts.filter(acc => acc.oauth_provider).length
    });

  } catch (error) {
    console.error('OAuth 계정 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
