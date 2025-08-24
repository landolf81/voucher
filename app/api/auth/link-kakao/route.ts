import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { phone, verificationCode, authUserId } = await request.json();

    if (!phone || !verificationCode || !authUserId) {
      return NextResponse.json(
        { success: false, message: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. SMS 인증 확인 (실제 구현에서는 SMS 인증 코드 검증 필요)
    // 현재는 간단한 인증으로 처리 (개발/테스트용)
    if (verificationCode !== '1234') { // 임시 인증 코드
      return NextResponse.json(
        { success: false, message: '인증 코드가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    // 2. 휴대폰 번호 형식 정리
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    
    // 3. 기존 회원 검색
    const { data: existingUser, error: searchError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('phone', cleanPhone)
      .eq('is_active', true)
      .single();

    if (searchError || !existingUser) {
      console.error('기존 회원 검색 오류:', searchError);
      return NextResponse.json(
        { 
          success: false, 
          message: '등록된 회원이 아닙니다. 관리자에게 문의하세요.',
          error: 'no_existing_user'
        },
        { status: 400 }
      );
    }

    // 4. 카카오 계정이 이미 다른 계정에 연동되어 있는지 확인
    const { data: alreadyLinked } = await supabase
      .from('user_profiles')
      .select('id, name')
      .eq('oauth_provider', 'kakao')
      .eq('oauth_provider_id', authUserId)
      .neq('id', existingUser.id)
      .single();

    if (alreadyLinked) {
      return NextResponse.json(
        { 
          success: false, 
          message: '이미 다른 계정에 연동된 카카오 계정입니다.',
          error: 'oauth_already_linked'
        },
        { status: 400 }
      );
    }

    // 5. 기존 회원 프로필에 카카오 정보 연동
    const { error: linkError } = await supabase
      .from('user_profiles')
      .update({
        oauth_provider: 'kakao',
        oauth_provider_id: authUserId,
        oauth_linked_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existingUser.id);

    if (linkError) {
      console.error('카카오 계정 연동 오류:', linkError);
      return NextResponse.json(
        { success: false, message: '계정 연동에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 6. auth.users 테이블의 메타데이터 업데이트
    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
      authUserId,
      {
        user_metadata: {
          linked_user_id: existingUser.id,
          oauth_provider: 'kakao',
          phone: cleanPhone,
          linked_at: new Date().toISOString()
        }
      }
    );

    if (authUpdateError) {
      console.error('Auth 메타데이터 업데이트 오류:', authUpdateError);
      // 메타데이터 업데이트 실패해도 연동은 성공으로 처리
    }

    // 7. 감사 로그 추가
    try {
      await supabase
        .from('audit_logs')
        .insert({
          action: 'oauth_account_linked',
          details: {
            user_id: existingUser.id,
            auth_user_id: authUserId,
            oauth_provider: 'kakao',
            phone: cleanPhone,
            user_name: existingUser.name,
            linked_at: new Date().toISOString()
          }
        });
    } catch (logError) {
      console.error('감사 로그 추가 실패:', logError);
      // 로그 실패는 무시하고 계속 진행
    }

    return NextResponse.json({
      success: true,
      message: '카카오 계정이 성공적으로 연동되었습니다.',
      user: {
        id: existingUser.id,
        name: existingUser.name,
        role: existingUser.role,
        oauth_provider: 'kakao'
      }
    });

  } catch (error) {
    console.error('카카오 계정 연동 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}