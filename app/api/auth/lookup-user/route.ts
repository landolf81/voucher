import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({
        success: false,
        message: 'user_id가 필요합니다.'
      }, { status: 400 });
    }

    // 서비스 롤 키로 auth.users 확인
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('사용자 조회 시작:', user_id);

    // auth.users에서 display_name으로 사용자 확인
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      console.error('Auth 사용자 조회 오류:', authError);
      return NextResponse.json({
        success: false,
        message: '사용자 조회 중 오류가 발생했습니다.'
      }, { status: 500 });
    }

    const targetUser = authUsers.users.find(user => {
      const displayName = user.user_metadata?.display_name || user.user_metadata?.user_id;
      return displayName === user_id;
    });

    if (!targetUser) {
      console.log('사용자 찾을 수 없음:', user_id);
      return NextResponse.json({
        success: false,
        message: '등록되지 않은 사용자 ID입니다.'
      }, { status: 404 });
    }

    const userMetadata = targetUser.user_metadata || {};

    if (userMetadata.is_active === false) {
      console.log('비활성화된 사용자:', user_id);
      return NextResponse.json({
        success: false,
        message: '비활성화된 사용자입니다.'
      }, { status: 403 });
    }

    console.log('사용자 조회 성공:', targetUser.id);

    return NextResponse.json({
      success: true,
      user: {
        user_id: userMetadata.display_name || user_id,
        name: userMetadata.name || userMetadata.display_name || user_id,
        role: userMetadata.role || 'user',
        email: targetUser.email || null,
        phone: targetUser.phone || null,
        has_email: !!targetUser.email,
        has_phone: !!targetUser.phone
      }
    });

  } catch (error) {
    console.error('사용자 조회 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}