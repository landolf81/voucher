import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Service role key를 사용하여 Supabase 클라이언트 생성
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. 모든 auth.users 조회
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      console.error('Auth 사용자 조회 오류:', authError);
      return NextResponse.json({
        success: false,
        message: 'Auth 사용자 조회에 실패했습니다.'
      }, { status: 500 });
    }

    let updatedCount = 0;
    let skippedCount = 0;
    const updateResults = [];

    // 2. 각 사용자의 display_name 확인 및 업데이트
    for (const user of authUsers.users) {
      const currentMetadata = user.user_metadata || {};
      const userId = currentMetadata.user_id;
      const currentDisplayName = currentMetadata.display_name;
      
      // user_id는 있지만 display_name이 없는 경우 업데이트
      if (userId && !currentDisplayName) {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          user.id,
          {
            user_metadata: {
              ...currentMetadata,
              display_name: userId  // user_id를 display_name으로 설정
            }
          }
        );

        if (updateError) {
          console.error(`사용자 ${user.id} display_name 업데이트 오류:`, updateError);
          updateResults.push({
            id: user.id,
            user_id: userId,
            status: 'failed',
            error: updateError.message
          });
        } else {
          updatedCount++;
          updateResults.push({
            id: user.id,
            user_id: userId,
            status: 'updated',
            message: `display_name을 ${userId}로 설정`
          });
          console.log(`✅ 사용자 ${user.id}의 display_name을 ${userId}로 업데이트`);
        }
      } else if (currentDisplayName) {
        skippedCount++;
        updateResults.push({
          id: user.id,
          user_id: userId,
          display_name: currentDisplayName,
          status: 'skipped',
          message: 'display_name이 이미 설정됨'
        });
      } else {
        skippedCount++;
        updateResults.push({
          id: user.id,
          status: 'skipped',
          message: 'user_id가 없어서 건너뜀'
        });
      }
    }

    // 3. user_profiles와 비교하여 누락된 display_name 추가 업데이트
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, user_id, name');

    if (!profileError && profiles) {
      for (const profile of profiles) {
        const authUser = authUsers.users.find(u => u.id === profile.id);
        if (authUser && profile.user_id) {
          const currentDisplayName = authUser.user_metadata?.display_name;
          
          if (!currentDisplayName) {
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
              profile.id,
              {
                user_metadata: {
                  ...authUser.user_metadata,
                  display_name: profile.user_id,
                  user_id: profile.user_id,
                  name: profile.name
                }
              }
            );

            if (!updateError) {
              updatedCount++;
              console.log(`✅ 프로필 기반으로 사용자 ${profile.id}의 display_name을 ${profile.user_id}로 업데이트`);
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `display_name 수정 완료`,
      summary: {
        total: authUsers.users.length,
        updated: updatedCount,
        skipped: skippedCount
      },
      details: updateResults
    });

  } catch (error) {
    console.error('display_name 일괄 수정 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}