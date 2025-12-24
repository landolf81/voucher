import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { UserMetadata } from '@/lib/types/auth';

/**
 * POST: user_profiles 데이터를 auth.users.user_metadata로 마이그레이션
 * 관리자 전용 API
 */
export async function POST(request: NextRequest) {
  try {
    // service_role 클라이언트 (RLS 우회)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 인증 확인 (Authorization 헤더)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const { data: { user: currentUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !currentUser) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    const currentMetadata = currentUser.user_metadata;
    if (currentMetadata?.role !== 'admin') {
      // user_profiles에서도 확인 (폴백)
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single();

      if (profile?.role !== 'admin') {
        return NextResponse.json(
          { success: false, message: '관리자 권한이 필요합니다.' },
          { status: 403 }
        );
      }
    }

    // user_profiles에서 모든 사용자 조회
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('*');

    if (profilesError) {
      console.error('user_profiles 조회 오류:', profilesError);
      return NextResponse.json(
        { success: false, message: 'user_profiles 조회 실패', error: profilesError.message },
        { status: 500 }
      );
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({
        success: true,
        message: '마이그레이션할 사용자가 없습니다.',
        migrated: 0,
        skipped: 0,
        errors: []
      });
    }

    const results = {
      migrated: 0,
      skipped: 0,
      errors: [] as { userId: string; error: string }[]
    };

    // 각 사용자의 user_metadata 업데이트
    for (const profile of profiles) {
      try {
        // 이미 마이그레이션된 사용자 확인
        const { data: { user: existingUser } } = await supabaseAdmin.auth.admin.getUserById(profile.id);

        if (existingUser?.user_metadata?.migrated_from_user_profiles) {
          results.skipped++;
          continue;
        }

        const userMetadata: UserMetadata = {
          display_name: profile.user_id, // 사원번호
          name: profile.name,
          role: profile.role,
          site_id: profile.site_id,
          is_active: profile.is_active ?? true,
          oauth_provider: profile.oauth_provider || undefined,
          oauth_provider_id: profile.oauth_provider_id || undefined,
          oauth_linked_at: profile.oauth_linked_at || undefined,
          migrated_from_user_profiles: true,
          migrated_at: new Date().toISOString()
        };

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          profile.id,
          { user_metadata: userMetadata }
        );

        if (updateError) {
          results.errors.push({
            userId: profile.id,
            error: updateError.message
          });
        } else {
          results.migrated++;
        }
      } catch (error) {
        results.errors.push({
          userId: profile.id,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `마이그레이션 완료: ${results.migrated}명 성공, ${results.skipped}명 스킵, ${results.errors.length}명 실패`,
      ...results
    });

  } catch (error) {
    console.error('마이그레이션 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * GET: 마이그레이션 상태 확인
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // user_profiles 전체 수
    const { count: profilesCount } = await supabaseAdmin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    // auth.users에서 마이그레이션된 사용자 수 확인
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();

    const migratedCount = authUsers?.users.filter(
      u => u.user_metadata?.migrated_from_user_profiles
    ).length || 0;

    const notMigratedCount = authUsers?.users.filter(
      u => !u.user_metadata?.migrated_from_user_profiles && !u.user_metadata?.role
    ).length || 0;

    return NextResponse.json({
      success: true,
      data: {
        total_profiles: profilesCount || 0,
        total_auth_users: authUsers?.users.length || 0,
        migrated: migratedCount,
        not_migrated: notMigratedCount,
        ready_to_remove_user_profiles: notMigratedCount === 0
      }
    });

  } catch (error) {
    console.error('상태 확인 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
