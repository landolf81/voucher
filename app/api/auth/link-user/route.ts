import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { user_id, email, phone } = await request.json();

    if (!user_id || (!email && !phone)) {
      return NextResponse.json({
        success: false,
        message: 'user_id와 email 또는 phone이 필요합니다.'
      }, { status: 400 });
    }

    // 서비스 롤 키로 user_profiles 확인
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // user_profiles에서 사용자 확인
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, name, user_id, role, site_id, is_active')
      .eq('user_id', user_id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({
        success: false,
        message: '등록되지 않은 사용자 ID입니다.'
      }, { status: 404 });
    }

    if (!userProfile.is_active) {
      return NextResponse.json({
        success: false,
        message: '비활성화된 사용자입니다.'
      }, { status: 403 });
    }

    // 일반 클라이언트로 OTP 전송
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let result;
    if (email) {
      // 이메일은 Magic Link 방식 사용
      result = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/admin/dashboard`,
          data: {
            // 사용자 메타데이터에 user_profiles 정보 저장
            user_id: userProfile.user_id,
            name: userProfile.name,
            role: userProfile.role,
            site_id: userProfile.site_id,
            profile_id: userProfile.id
          }
        }
      });
    } else if (phone) {
      console.log('SMS 전송 시도:', phone);
      result = await supabase.auth.signInWithOtp({
        phone: phone,
        options: {
          channel: 'sms',
          data: {
            user_id: userProfile.user_id,
            name: userProfile.name,
            role: userProfile.role,
            site_id: userProfile.site_id,
            profile_id: userProfile.id
          }
        }
      });
      console.log('SMS 전송 결과:', result);
    }

    if (result?.error) {
      console.error('OTP 전송 오류:', result.error);
      return NextResponse.json({
        success: false,
        message: 'OTP 전송에 실패했습니다.',
        error: result.error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${userProfile.name}님, ${email ? '로그인 링크가 이메일로' : '인증 코드가 SMS로'} 전송되었습니다.`,
      user: {
        user_id: userProfile.user_id,
        name: userProfile.name,
        role: userProfile.role
      }
    });

  } catch (error) {
    console.error('사용자 연결 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}