import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidUserMetadata } from '@/lib/types/auth';

/**
 * GET: 현재 인증된 사용자의 프로필 조회
 * - user_metadata 우선 사용 (마이그레이션 후)
 * - user_profiles 폴백 (마이그레이션 전)
 */
export async function GET(request: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    // service_role 클라이언트
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 토큰으로 사용자 확인
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);

    if (authError || !user) {
      console.error('토큰 검증 실패:', authError?.message);
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const metadata = user.user_metadata;

    // 1. user_metadata에 유효한 프로필이 있으면 사용
    if (isValidUserMetadata(metadata)) {
      // site_name만 조회
      const { data: site } = await serviceClient
        .from('sites')
        .select('site_name')
        .eq('id', metadata.site_id)
        .single();

      return NextResponse.json({
        success: true,
        source: 'user_metadata',
        data: {
          id: user.id,
          display_name: metadata.display_name,
          name: metadata.name,
          role: metadata.role,
          site_id: metadata.site_id,
          site_name: site?.site_name,
          is_active: metadata.is_active ?? true,
          email: user.email,
          phone: user.phone,
          oauth_provider: metadata.oauth_provider,
          oauth_provider_id: metadata.oauth_provider_id,
          oauth_linked_at: metadata.oauth_linked_at,
          auth_provider: user.app_metadata?.provider
        }
      });
    }

    // 2. 폴백: user_profiles 테이블에서 조회
    console.log('user_metadata 없음, user_profiles 폴백:', user.id);

    const { data: profile, error } = await serviceClient
      .from('user_profiles')
      .select(`
        *,
        sites (
          id,
          site_name
        )
      `)
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('프로필 조회 오류:', error);
      return NextResponse.json(
        { success: false, message: '프로필 조회 실패', error: error.message },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { success: false, message: '프로필을 찾을 수 없습니다.', user_id: user.id },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      source: 'user_profiles',
      data: {
        id: profile.id,
        display_name: profile.user_id, // user_profiles.user_id = 사원번호
        user_id: profile.user_id, // 호환성을 위해 유지
        name: profile.name,
        role: profile.role,
        site_id: profile.site_id,
        sites: profile.sites,
        site_name: profile.sites?.site_name,
        is_active: profile.is_active,
        email: user.email || profile.email,
        phone: user.phone || profile.phone,
        oauth_provider: profile.oauth_provider,
        oauth_provider_id: profile.oauth_provider_id,
        oauth_linked_at: profile.oauth_linked_at,
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
