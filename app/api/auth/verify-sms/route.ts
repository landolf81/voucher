import { NextRequest, NextResponse } from 'next/server';
import { getSMSService } from '@/lib/sms';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 요청 본문 검증 스키마
const verifySMSSchema = z.object({
  userId: z.string().min(1).max(50),
  code: z.string().length(6).regex(/^\d{6}$/, '인증번호는 6자리 숫자여야 합니다.'),
});

export async function POST(request: NextRequest) {
  try {
    // 요청 본문 파싱
    const body = await request.json();
    
    // 입력 검증
    const validation = verifySMSSchema.safeParse(body);
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

    const { userId, code } = validation.data;
    console.log('검증 API - 받은 사용자ID:', userId, '인증번호:', code);

    // 사용자 조회 (ID로 전화번호 찾기)
    console.log('Supabase 사용 - 사용자 조회 (검증)');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: supabaseUser, error: userError } = await supabase
      .from('users')
      .select('phone')
      .eq('user_id', userId)
      .single();

    if (userError || !supabaseUser) {
      return NextResponse.json(
        {
          success: false,
          message: '사용자를 찾을 수 없습니다.',
        },
        { status: 404 }
      );
    }
    const userPhone = supabaseUser.phone;

    // SMS 서비스 인스턴스 가져오기
    const smsService = getSMSService();

    // 전화번호로 인증번호 검증
    const result = await smsService.verifyCode(userPhone, code);

    if (result.success) {
      // 인증 성공 시 세션 토큰 생성을 위한 임시 토큰 발급
      // 실제 로그인은 /api/auth/login에서 처리
      const verificationToken = Buffer.from(
        JSON.stringify({ userId, verified: true, timestamp: Date.now() })
      ).toString('base64');

      return NextResponse.json(
        {
          success: true,
          message: result.message || '인증이 완료되었습니다.',
          verificationToken, // 임시 토큰 (로그인 API에서 사용)
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          message: result.message || '인증번호가 일치하지 않습니다.',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('SMS 검증 API 오류:', error);
    
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}