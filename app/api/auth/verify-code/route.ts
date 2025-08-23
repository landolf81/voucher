import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { sign } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: NextRequest) {
  try {
    const { verificationId, code } = await request.json();

    if (!verificationId || !code) {
      return NextResponse.json({
        success: false,
        message: '인증 ID와 코드가 필요합니다.'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 인증 코드 조회 및 검증
    const { data: verification, error: verifyError } = await supabase
      .from('verification_codes')
      .select('id, user_id, code, method, expires_at, used')
      .eq('id', verificationId)
      .eq('used', false)
      .single();

    if (verifyError || !verification) {
      return NextResponse.json({
        success: false,
        message: '유효하지 않은 인증 요청입니다.'
      }, { status: 400 });
    }

    // 사용자 프로필 조회
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, name, role, site_id, phone, email, user_id')
      .eq('user_id', verification.user_id as string)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({
        success: false,
        message: '사용자 프로필을 찾을 수 없습니다.'
      }, { status: 400 });
    }

    // 만료 시간 확인
    const now = new Date();
    const expiresAt = new Date(verification.expires_at as string);
    
    if (now > expiresAt) {
      return NextResponse.json({
        success: false,
        message: '인증 코드가 만료되었습니다.'
      }, { status: 400 });
    }

    // 코드 확인
    if (verification.code !== code) {
      return NextResponse.json({
        success: false,
        message: '인증 코드가 올바르지 않습니다.'
      }, { status: 400 });
    }

    // 인증 코드 사용 처리
    const { error: updateError } = await supabase
      .from('verification_codes')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('id', verificationId);

    if (updateError) {
      console.error('인증 코드 업데이트 오류:', updateError);
    }

    // JWT 토큰 생성
    const token = sign(
      {
        sub: userProfile.id,
        user_id: userProfile.user_id,
        name: userProfile.name,
        role: userProfile.role,
        site_id: userProfile.site_id,
        phone: userProfile.phone,
        email: userProfile.email,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24시간
      },
      JWT_SECRET
    );

    // 로그인 이력 기록
    await supabase
      .from('login_history')
      .insert({
        user_id: userProfile.id,
        login_method: verification.method,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        success: true
      });

    // 응답 설정 (쿠키에 토큰 저장)
    const response = NextResponse.json({
      success: true,
      message: '로그인에 성공했습니다.',
      user: {
        id: userProfile.id,
        name: userProfile.name,
        role: userProfile.role,
        site_id: userProfile.site_id,
        user_id: userProfile.user_id
      }
    });

    // HTTP-only 쿠키로 JWT 토큰 설정
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24시간
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('인증 코드 검증 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}