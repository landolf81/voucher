import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { phone, email } = await request.json();

    if (!phone && !email) {
      return NextResponse.json({
        success: false,
        message: '전화번호 또는 이메일이 필요합니다.'
      }, { status: 400 });
    }

    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let result;

    if (phone) {
      // 전화번호로 OTP 전송
      result = await supabase.auth.signInWithOtp({
        phone: phone,
        options: {
          channel: 'sms'
        }
      });
    } else if (email) {
      // 이메일로 Magic Link 전송
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
      
      result = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: `${baseUrl}/login`
        }
      });
    }

    if (result?.error) {
      console.error('OTP 전송 오류:', result.error);
      return NextResponse.json({
        success: false,
        message: 'OTP 전송에 실패했습니다.',
        error: result.error.message,
        details: result.error
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `인증 코드가 ${phone ? 'SMS' : '이메일'}로 전송되었습니다.`
    });

  } catch (error) {
    console.error('OTP 전송 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}