import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidUserMetadata, getAuthz } from '@/lib/types/auth';

// Supabase Admin 클라이언트 싱글톤
let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabaseAdminInstance;
}

export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({
        success: false,
        message: 'user_id가 필요합니다.'
      }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // auth.users에서 display_name으로 사용자 검색
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      console.error('Auth users 조회 오류:', authError);
      return NextResponse.json({
        success: false,
        message: '사용자 인증 정보 조회 중 오류가 발생했습니다.'
      }, { status: 500 });
    }

    // display_name이나 user_metadata에서 user_id와 일치하는 사용자 찾기
    const targetAuthUser = authUsers.users.find(user => {
      const displayName = user.user_metadata?.display_name || user.user_metadata?.user_id;
      return displayName === user_id || user.id === user_id;
    });

    if (!targetAuthUser) {
      return NextResponse.json({
        success: false,
        message: '등록되지 않은 사용자 ID입니다.',
        user_exists: false
      }, { status: 404 });
    }

    const metadata = targetAuthUser.user_metadata;
    const authz = getAuthz(targetAuthUser);

    // app_metadata에서 is_active 확인
    if (authz && authz.is_active === false) {
      return NextResponse.json({
        success: false,
        message: '비활성화된 사용자입니다.',
        user_exists: true,
        is_active: false
      }, { status: 403 });
    }

    // 사용자 정보 결정
    let userName: string;
    let userRole: string;
    let isActive: boolean;

    if (isValidUserMetadata(metadata) && authz) {
      userName = metadata.name;
      userRole = authz.role;
      isActive = authz.is_active;
    } else {
      userName = targetAuthUser.user_metadata?.display_name || user_id;
      userRole = 'user';
      isActive = true;
    }

    // 사용자 상태 정보 반환
    const hasEmail = !!targetAuthUser.email;
    const hasPhone = !!targetAuthUser.phone;

    return NextResponse.json({
      success: true,
      user_exists: true,
      is_active: isActive,
      user: {
        user_id: user_id,
        name: userName,
        role: userRole
      },
      has_email: hasEmail,
      has_phone: hasPhone,
      email: hasEmail ? targetAuthUser.email : null,
      phone: hasPhone ? targetAuthUser.phone : null,
      recommended_auth: hasEmail ? 'email' : (hasPhone ? 'sms' : null),
      available_auth_methods: [
        ...(hasEmail ? ['email'] : []),
        ...(hasPhone && !hasEmail ? ['sms'] : [])
      ],
      needs_email_setup: !hasEmail && hasPhone
    });

  } catch (error) {
    console.error('사용자 상태 확인 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
