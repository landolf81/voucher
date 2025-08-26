import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({
        success: false,
        message: 'user_id가 필요합니다.'
      }, { status: 400 });
    }

    // 서비스 롤 키로 Supabase Admin 클라이언트 생성
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // auth.users에서 display_name으로 사용자 검색
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      console.error('Auth users 조회 오류:', authError);
      return NextResponse.json({
        success: false,
        message: '사용자 인증 정보 조회 중 오류가 발생했습니다.'
      }, { status: 500 });
    }

    // display_name이나 user_metadata에서 user_id와 일치하는 사용자 찾기
    const targetAuthUser = authUsers.users.find(user => {
      const displayName = user.user_metadata?.display_name || user.user_metadata?.user_id;
      return displayName === user_id || user.id === user_id;
    });

    if (!targetAuthUser) {
      return NextResponse.json({
        success: false,
        message: '등록되지 않은 사용자 ID입니다.',
        user_exists: false
      }, { status: 404 });
    }

    // user_profiles에서 추가 정보 조회 (이름, 역할 등)
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, name, user_id, role, site_id, is_active')
      .eq('user_id', user_id)
      .maybeSingle();

    // user_profiles가 없어도 auth.users 정보로 진행 가능하지만, 
    // 있다면 활성화 상태 확인
    if (userProfile && !userProfile.is_active) {
      return NextResponse.json({
        success: false,
        message: '비활성화된 사용자입니다.',
        user_exists: true,
        is_active: false
      }, { status: 403 });
    }

    // 사용자 상태 정보 반환
    const hasEmail = !!targetAuthUser.email;
    const hasPhone = !!targetAuthUser.phone;
    const userName = userProfile?.name || targetAuthUser.user_metadata?.display_name || user_id;

    return NextResponse.json({
      success: true,
      user_exists: true,
      is_active: userProfile?.is_active !== false,
      user: {
        user_id: user_id,
        name: userName,
        role: userProfile?.role || 'user'
      },
      // 인증 방법 정보
      has_email: hasEmail,
      has_phone: hasPhone,
      email: hasEmail ? targetAuthUser.email : null,
      phone: hasPhone ? targetAuthUser.phone : null,
      // 권장 인증 방법
      recommended_auth: hasEmail ? 'email' : (hasPhone ? 'sms' : null),
      // 사용 가능한 인증 방법들
      available_auth_methods: [
        ...(hasEmail ? ['email'] : []),
        ...(hasPhone && !hasEmail ? ['sms'] : []) // 이메일이 있으면 SMS 차단
      ],
      // 이메일 설정 필요 여부
      needs_email_setup: !hasEmail && hasPhone
    });

  } catch (error) {
    console.error('사용자 상태 확인 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}