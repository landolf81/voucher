import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { authUserId } = await request.json();

    if (!authUserId) {
      return NextResponse.json(
        { success: false, message: 'Auth User ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. auth.users에서 사용자 정보 확인
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(authUserId);

    if (authError || !authUser.user) {
      console.error('Auth 사용자 조회 오류:', authError);
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 2. 이미 연동된 프로필이 있는지 확인
    const { data: existingProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select(`
        id,
        name,
        email,
        phone,
        role,
        site_id,
        is_active,
        oauth_provider,
        oauth_provider_id,
        oauth_linked_at,
        sites (
          id,
          site_name
        )
      `)
      .or(`id.eq.${authUserId},oauth_provider_id.eq.${authUserId}`)
      .eq('is_active', true)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116은 "not found" 에러
      console.error('프로필 조회 오류:', profileError);
      return NextResponse.json(
        { success: false, message: '프로필 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (existingProfile) {
      // 이미 연동된 계정이 있음
      return NextResponse.json({
        success: true,
        linking_required: false,
        user_profile: {
          id: existingProfile.id,
          name: existingProfile.name,
          email: existingProfile.email,
          phone: existingProfile.phone,
          role: existingProfile.role,
          site_id: existingProfile.site_id,
          site_name: existingProfile.sites?.site_name,
          is_active: existingProfile.is_active,
          oauth_provider: existingProfile.oauth_provider,
          oauth_provider_id: existingProfile.oauth_provider_id,
          oauth_linked_at: existingProfile.oauth_linked_at
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