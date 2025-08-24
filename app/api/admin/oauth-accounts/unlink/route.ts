import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get user info for audit log
    const { data: userInfo, error: userError } = await supabase
      .from('user_profiles')
      .select('id, name, oauth_provider, oauth_provider_id')
      .eq('id', userId)
      .single();

    if (userError || !userInfo) {
      console.error('사용자 정보 조회 오류:', userError);
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (!userInfo.oauth_provider) {
      return NextResponse.json(
        { success: false, message: '해당 사용자는 OAuth 연동이 되어 있지 않습니다.' },
        { status: 400 }
      );
    }

    // Remove OAuth linking from user profile
    const { error: unlinkError } = await supabase
      .from('user_profiles')
      .update({
        oauth_provider: null,
        oauth_provider_id: null,
        oauth_linked_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (unlinkError) {
      console.error('OAuth 연동 해제 오류:', unlinkError);
      return NextResponse.json(
        { success: false, message: 'OAuth 연동 해제에 실패했습니다.' },
        { status: 500 }
      );
    }

    // Add audit log
    try {
      await supabase
        .from('audit_logs')
        .insert({
          action: 'oauth_account_unlinked',
          details: {
            user_id: userId,
            user_name: userInfo.name,
            oauth_provider: userInfo.oauth_provider,
            oauth_provider_id: userInfo.oauth_provider_id,
            unlinked_at: new Date().toISOString(),
            unlinked_by: 'admin' // TODO: Get actual admin user from session
          }
        });
    } catch (logError) {
      console.error('감사 로그 추가 실패:', logError);
      // 로그 실패는 무시하고 계속 진행
    }

    return NextResponse.json({
      success: true,
      message: `${userInfo.name}님의 ${userInfo.oauth_provider} 연동이 해제되었습니다.`
    });

  } catch (error) {
    console.error('OAuth 연동 해제 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}