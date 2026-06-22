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
    
    // 3. auth.users에서 해당 전화번호로 기존 회원 검색
    const { data: authUsers, error: searchError } = await supabase.auth.admin.listUsers();

    if (searchError) {
      console.error('사용자 검색 오류:', searchError);
      return NextResponse.json(
        {
          success: false,
          message: '사용자 검색 중 오류가 발생했습니다.',
          error: 'search_error'
        },
        { status: 500 }
      );
    }

    // E.164 형식으로 변환하여 비교
    const e164Phone = cleanPhone.startsWith('010') ? `+82${cleanPhone.substring(1)}` : `+82${cleanPhone}`;
    const existingUser = authUsers.users.find(user => {
      return user.phone === e164Phone && user.app_metadata?.is_active !== false;
    });

    if (!existingUser) {
      console.error('기존 회원을 찾을 수 없음:', cleanPhone);
      return NextResponse.json(
        {
          success: false,
          message: '등록된 회원이 아닙니다. 관리자에게 문의하세요.',
          error: 'no_existing_user'
        },
        { status: 400 }
      );
    }

    const existingMetadata = existingUser.user_metadata || {};

    // 4. 카카오 계정이 이미 다른 계정에 연동되어 있는지 확인
    const alreadyLinked = authUsers.users.find(user =>
      user.user_metadata?.oauth_provider === 'kakao' &&
      user.user_metadata?.oauth_provider_id === authUserId &&
      user.id !== existingUser.id
    );

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

    // 5. auth.users의 user_metadata에 카카오 정보 연동
    const { error: linkError } = await supabase.auth.admin.updateUserById(
      existingUser.id,
      {
        user_metadata: {
          ...existingMetadata,
          oauth_provider: 'kakao',
          oauth_provider_id: authUserId,
          oauth_linked_at: new Date().toISOString()
        }
      }
    );

    if (linkError) {
      console.error('카카오 계정 연동 오류:', linkError);
      return NextResponse.json(
        { success: false, message: '계정 연동에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 6. 감사 로그 추가
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
            user_name: existingMetadata.name || existingMetadata.display_name,
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
        name: existingMetadata.name || existingMetadata.display_name,
        role: existingMetadata.role || 'user',
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