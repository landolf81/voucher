import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token } = await request.json();

    if (!access_token || !refresh_token) {
      return NextResponse.json({
        success: false,
        message: '토큰이 필요합니다.'
      }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 매직링크 토큰으로 세션 설정
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token
    });

    if (error) {
      return NextResponse.json({
        success: false,
        message: '토큰이 유효하지 않습니다.'
      }, { status: 400 });
    }

    const user = data.user;
    const userMetadata = user?.user_metadata || {};

    return NextResponse.json({
      success: true,
      user: {
        id: user?.id,
        email: user?.email,
        user_id: userMetadata.user_id,
        name: userMetadata.name,
        role: userMetadata.role,
        site_id: userMetadata.site_id,
        profile_id: userMetadata.profile_id
      },
      session: data.session,
      message: `${userMetadata.name || '사용자'}님, 로그인이 완료되었습니다.`
    });

  } catch (error) {
    console.error('매직링크 검증 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}