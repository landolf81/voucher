import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { phone, email, token } = await request.json();

    if (!token || (!phone && !email)) {
      return NextResponse.json({
        success: false,
        message: '인증 코드와 전화번호/이메일이 필요합니다.'
      }, { status: 400 });
    }

    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let result;

    if (phone) {
      // 한국 전화번호를 E.164 형식으로 변환 (예: 01012345678 → +8201012345678)
      const e164Phone = phone.startsWith('+') ? phone : `+82${phone.substring(1)}`;
      console.log('OTP 검증 시도:', phone, '→', e164Phone);
      
      // 전화번호 OTP 검증
      result = await supabase.auth.verifyOtp({
        phone: e164Phone,
        token: token,
        type: 'sms'
      });
    } else if (email) {
      // 이메일 OTP 검증
      result = await supabase.auth.verifyOtp({
        email: email,
        token: token,
        type: 'email'
      });
    }

    if (result?.error) {
      console.error('OTP 검증 오류:', result.error);
      return NextResponse.json({
        success: false,
        message: '인증 코드가 올바르지 않습니다.'
      }, { status: 400 });
    }

    // 로그인 성공
    const { data: { user, session } } = result!;

    // 사용자 메타데이터에서 프로필 정보 추출
    const userMetadata = user?.user_metadata || {};
    
    return NextResponse.json({
      success: true,
      user: {
        id: user?.id,
        email: user?.email,
        phone: user?.phone,
        // user_profiles 테이블의 정보
        user_id: userMetadata.user_id,
        name: userMetadata.name,
        role: userMetadata.role,
        site_id: userMetadata.site_id,
        profile_id: userMetadata.profile_id
      },
      session,
      message: `${userMetadata.name || '사용자'}님, 로그인이 완료되었습니다.`
    });

  } catch (error) {
    console.error('OTP 검증 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}