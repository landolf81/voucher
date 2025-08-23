import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { generateJWT } from '@/lib/jwt';
import { z } from 'zod';

// 요청 본문 검증 스키마
const loginSchema = z.object({
  userId: z.string().min(1).max(50),
  verificationToken: z.string(), // verify-sms에서 받은 임시 토큰
});

export async function POST(request: NextRequest) {
  try {
    console.log('로그인 API 호출됨');
    // 요청 본문 파싱
    const body = await request.json();
    console.log('로그인 요청 데이터:', body);
    
    // 입력 검증
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          message: '입력 정보가 올바르지 않습니다.',
          errors: validation.error.errors 
        },
        { status: 400 }
      );
    }

    const { userId, verificationToken } = validation.data;

    // 인증 토큰 검증
    try {
      const decodedToken = JSON.parse(
        Buffer.from(verificationToken, 'base64').toString()
      );
      
      // 토큰 유효성 검사 (5분)
      const tokenAge = Date.now() - decodedToken.timestamp;
      if (tokenAge > 5 * 60 * 1000) {
        return NextResponse.json(
          {
            success: false,
            message: '인증 토큰이 만료되었습니다. 다시 인증해주세요.',
          },
          { status: 401 }
        );
      }
      
      // 사용자 ID 일치 확인
      if (decodedToken.userId !== userId || !decodedToken.verified) {
        return NextResponse.json(
          {
            success: false,
            message: '유효하지 않은 인증 정보입니다.',
          },
          { status: 401 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: '인증 토큰이 유효하지 않습니다.',
        },
        { status: 401 }
      );
    }

    // Supabase 사용자 조회
    console.log('Supabase 사용 - 사용자 조회');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: user, error: userError } = await supabase
      .from('user_profiles')
      .select('id, name, role, site_id, user_id')
      .eq('user_id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: '등록되지 않은 사용자입니다. 관리자에게 문의하세요.',
          needsRegistration: true,
        },
        { status: 404 }
      );
    }

    // JWT 토큰 생성
    const jwtToken = generateJWT({
      sub: user.id,
      name: user.name,
      role: user.role,
      site_id: user.site_id,
    });

    // 로그인 기록 (audit_logs)
    await supabase.from('audit_logs').insert({
      action: 'login',
      actor_user_id: user.id,
      site_id: user.site_id,
      details: {
        userId,
        login_time: new Date().toISOString(),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        user_agent: request.headers.get('user-agent'),
      },
    });

    // 응답 생성
    const response = NextResponse.json(
      {
        success: true,
        message: '로그인에 성공했습니다.',
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          site_id: user.site_id,
        },
        token: jwtToken,
      },
      { status: 200 }
    );

    // JWT 토큰을 쿠키에도 설정 (httpOnly)
    response.cookies.set({
      name: 'jwt',
      value: jwtToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24시간
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('로그인 API 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

// 로그아웃 API
export async function DELETE(request: NextRequest) {
  try {
    // JWT 쿠키 제거
    const response = NextResponse.json(
      {
        success: true,
        message: '로그아웃되었습니다.',
      },
      { status: 200 }
    );

    response.cookies.delete('jwt');
    
    return response;
  } catch (error) {
    console.error('로그아웃 API 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

// OPTIONS 요청 처리 (CORS)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}