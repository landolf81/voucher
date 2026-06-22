import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidUserMetadata, getAuthz } from '@/lib/types/auth';

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

export async function POST(request: NextRequest) {
  try {
    const { authUserId } = await request.json();

    if (!authUserId) {
      return NextResponse.json(
        { success: false, message: 'Auth User ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. auth.users에서 사용자 정보 확인
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(authUserId);

    if (authError || !authUser.user) {
      console.error('Auth 사용자 조회 오류:', authError);
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const metadata = authUser.user.user_metadata || {};
    const authz = getAuthz(authUser.user);

    // 2. 프로필(user_metadata) + 권한(app_metadata) 정보 확인
    if (isValidUserMetadata(metadata) && authz && authz.is_active !== false) {
      // 프로필이 있음
      const { data: site } = await supabase
        .from('sites')
        .select('site_name')
        .eq('id', authz.site_id)
        .single();

      return NextResponse.json({
        success: true,
        linking_required: false,
        user_profile: {
          id: authUser.user.id,
          name: metadata.name,
          email: authUser.user.email,
          phone: authUser.user.phone,
          role: authz.role,
          site_id: authz.site_id,
          site_name: (site as { site_name: string } | null)?.site_name,
          is_active: authz.is_active,
          oauth_provider: metadata.oauth_provider,
          oauth_provider_id: metadata.oauth_provider_id,
          oauth_linked_at: metadata.oauth_linked_at
        }
      });
    } else {
      // 연동이 필요함
      return NextResponse.json({
        success: true,
        linking_required: true,
        auth_user_id: authUserId,
        provider: authUser.user.app_metadata?.provider || 'unknown'
      });
    }

  } catch (error) {
    console.error('OAuth 연동 상태 확인 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const authUserId = url.searchParams.get('authUserId');

    if (!authUserId) {
      return NextResponse.json(
        { success: false, message: 'Auth User ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // POST 메서드와 동일한 로직 실행
    const postRequest = new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({ authUserId })
    });

    return POST(postRequest);

  } catch (error) {
    console.error('OAuth 연동 상태 확인 GET API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
