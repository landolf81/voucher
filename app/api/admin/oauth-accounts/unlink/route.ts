import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // auth.users에서 사용자 정보 조회
    const { data: authUser, error: userError } = await supabase.auth.admin.getUserById(userId);

    if (userError || !authUser.user) {
      console.error('사용자 정보 조회 오류:', userError);
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const metadata = authUser.user.user_metadata || {};

    if (!metadata.oauth_provider) {
      return NextResponse.json(
        { success: false, message: '해당 사용자는 OAuth 연동이 되어 있지 않습니다.' },
        { status: 400 }
      );
    }

    // user_metadata에서 OAuth 정보 제거
    const { error: unlinkError } = await supabase.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          ...metadata,
          oauth_provider: null,
          oauth_provider_id: null,
          oauth_linked_at: null
        }
      }
    );

    if (unlinkError) {
      console.error('OAuth 연동 해제 오류:', unlinkError);
      return NextResponse.json(
        { success: false, message: 'OAuth 연동 해제에 실패했습니다.' },
        { status: 500 }
      );
    }

    // Add audit log
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('audit_logs')
        .insert({
          action: 'oauth_account_unlinked',
          details: {
            user_id: userId,
            user_name: metadata.name || metadata.display_name,
            oauth_provider: metadata.oauth_provider,
            oauth_provider_id: metadata.oauth_provider_id,
            unlinked_at: new Date().toISOString(),
            unlinked_by: 'admin'
          }
        });
    } catch (logError) {
      console.error('감사 로그 추가 실패:', logError);
    }

    return NextResponse.json({
      success: true,
      message: `${metadata.name || metadata.display_name}님의 ${metadata.oauth_provider} 연동이 해제되었습니다.`
    });

  } catch (error) {
    console.error('OAuth 연동 해제 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
