import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { email, user_id } = await request.json();

    if (!email || !user_id) {
      return NextResponse.json({
        success: false,
        message: 'email과 user_id가 필요합니다.'
      }, { status: 400 });
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        success: false,
        message: '올바른 이메일 형식이 아닙니다.'
      }, { status: 400 });
    }

    // 서비스 롤 키로 Supabase Admin 클라이언트 생성
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 해당 user_id의 사용자 확인
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, name, user_id, role, site_id, is_active')
      .eq('user_id', user_id)
      .maybeSingle();

    if (profileError || !userProfile) {
      console.error('사용자 프로필 조회 오류:', profileError);
      return NextResponse.json({
        success: false,
        message: '등록되지 않은 사용자입니다.'
      }, { status: 404 });
    }

    if (!userProfile.is_active) {
      return NextResponse.json({
        success: false,
        message: '비활성화된 사용자입니다.'
      }, { status: 403 });
    }

    // 중복 이메일 확인 (다른 사용자가 이미 사용 중인지)
    const { data: existingUsers, error: existingError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (existingError) {
      console.error('사용자 목록 조회 오류:', existingError);
      return NextResponse.json({
        success: false,
        message: '사용자 정보 확인 중 오류가 발생했습니다.'
      }, { status: 500 });
    }

    // 해당 이메일을 사용하는 다른 사용자가 있는지 확인
    const duplicateUser = existingUsers.users.find(user => 
      user.email?.toLowerCase() === email.toLowerCase() && 
      user.user_metadata?.user_id !== user_id
    );

    if (duplicateUser) {
      return NextResponse.json({
        success: false,
        message: '이미 다른 사용자가 사용 중인 이메일입니다.'
      }, { status: 409 });
    }

    // 현재 사용자의 auth.users 레코드 찾기
    const targetAuthUser = existingUsers.users.find(user => {
      const displayName = user.user_metadata?.display_name || user.user_metadata?.user_id;
      return displayName === user_id;
    });

    if (!targetAuthUser) {
      return NextResponse.json({
        success: false,
        message: '인증 사용자 정보를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // auth.users에 이메일 업데이트
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetAuthUser.id,
      { 
        email: email.toLowerCase(),
        email_confirm: true
      }
    );

    if (updateError) {
      console.error('Auth 사용자 이메일 업데이트 오류:', updateError);
      return NextResponse.json({
        success: false,
        message: '이메일 등록 중 오류가 발생했습니다.'
      }, { status: 500 });
    }

    // 이메일 인증 링크 전송
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // API Route에서 origin 추출
    const origin = request.headers.get('origin') || 
                   request.headers.get('referer')?.replace(/\/[^\/]*$/, '') ||
                   process.env.NEXT_PUBLIC_SITE_URL ||
                   'https://voucher-iota.vercel.app';
    
    const redirectTo = `${origin}/login?type=email_verification&user=${user_id}`;
    
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: {
        shouldCreateUser: false, // 이미 사용자가 존재함
        emailRedirectTo: redirectTo,
        data: {
          user_id: user_id,
          name: userProfile.name,
          role: userProfile.role,
          site_id: userProfile.site_id,
          profile_id: userProfile.id,
          auth_user_id: targetAuthUser.id,
          email_verification: true
        }
      }
    });

    if (otpError) {
      console.error('이메일 인증 링크 전송 오류:', otpError);
      return NextResponse.json({
        success: false,
        message: '이메일 인증 링크 전송에 실패했습니다.',
        error: otpError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${userProfile.name}님의 이메일이 등록되었습니다.`,
      user: {
        user_id: user_id,
        name: userProfile.name,
        email: email.toLowerCase()
      }
    });

  } catch (error) {
    console.error('이메일 등록 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}