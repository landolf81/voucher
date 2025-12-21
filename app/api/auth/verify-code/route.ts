import { NextRequest, NextResponse } from 'next/server';

/**
 * 레거시 인증 코드 검증 API
 * 이 API는 더 이상 사용되지 않습니다.
 * 현재 시스템은 Supabase Auth의 OTP 인증 (verify-otp)을 사용합니다.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: '이 인증 방식은 더 이상 지원되지 않습니다. OTP 인증을 사용해주세요.'
  }, { status: 410 }); // Gone - 더 이상 사용할 수 없음
}
