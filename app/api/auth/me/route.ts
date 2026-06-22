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

/**
 * GET: 현재 인증된 사용자의 프로필 조회
 * - auth.users.user_metadata만 사용
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const serviceClient = getSupabaseAdmin();

    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);

    if (authError || !user) {
      console.error('토큰 검증 실패:', authError?.message);
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const metadata = user.user_metadata;
    const authz = getAuthz(user);

    if (!isValidUserMetadata(metadata) || !authz) {
      return NextResponse.json(
        { success: false, message: '프로필을 찾을 수 없습니다.', user_id: user.id },
        { status: 404 }
      );
    }

    // site_name 조회
    const { data: site } = await serviceClient
      .from('sites')
      .select('site_name')
      .eq('id', authz.site_id)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        display_name: metadata.display_name,
        name: metadata.name,
        role: authz.role,
        site_id: authz.site_id,
        site_name: (site as { site_name: string } | null)?.site_name,
        is_active: authz.is_active,
        email: user.email,
        phone: user.phone,
        oauth_provider: metadata.oauth_provider,
        oauth_provider_id: metadata.oauth_provider_id,
        oauth_linked_at: metadata.oauth_linked_at,
        auth_provider: user.app_metadata?.provider
      }
    });

  } catch (error) {
    console.error('프로필 조회 예외:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
