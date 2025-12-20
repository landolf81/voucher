import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { formatPhoneForDB, validateKoreanPhoneInput } from '@/lib/phone-utils';
import { isValidUserMetadata, type UserMetadata } from '@/lib/types/auth';

/**
 * GET: 사용자 프로필 조회
 * - user_metadata 우선, user_profiles 폴백
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. auth.users에서 사용자 조회
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (authError || !authUser) {
      console.error('Auth 사용자 조회 오류:', authError);
      return NextResponse.json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    const metadata = authUser.user_metadata;

    // 2. sites 조회
    const { data: sites } = await supabaseAdmin
      .from('sites')
      .select('id, site_name');

    const sitesMap = new Map(sites?.map(s => [s.id, s.site_name]) || []);

    // 3. user_metadata가 유효하면 사용
    if (isValidUserMetadata(metadata)) {
      return NextResponse.json({
        success: true,
        source: 'user_metadata',
        data: {
          id: authUser.id,
          display_name: metadata.display_name,
          user_id: metadata.display_name, // 호환성
          name: metadata.name,
          role: metadata.role,
          site_id: metadata.site_id,
          site_name: sitesMap.get(metadata.site_id) || '',
          sites: { id: metadata.site_id, site_name: sitesMap.get(metadata.site_id) || '' },
          is_active: metadata.is_active ?? true,
          email: authUser.email || '',
          phone: authUser.phone || '',
          oauth_provider: metadata.oauth_provider,
          oauth_provider_id: metadata.oauth_provider_id,
          oauth_linked_at: metadata.oauth_linked_at
        }
      });
    }

    // 4. 폴백: user_profiles에서 조회
    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .select(`
        *,
        sites (
          id,
          site_name
        )
      `)
      .eq('id', userId)
      .single();

    if (error || !profile) {
      console.error('프로필 조회 오류:', error);
      return NextResponse.json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      source: 'user_profiles',
      data: {
        ...profile,
        display_name: profile.user_id, // 사원번호
        email: authUser.email || profile.email || '',
        phone: authUser.phone || profile.phone || ''
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

/**
 * PUT: 사용자 정보 업데이트
 * - user_metadata와 user_profiles 모두 업데이트 (점진적 전환)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const body = await request.json();
    const { email, phone, name, role, site_id, is_active, user_id } = body;

    // 필수 필드 확인
    if (!name || !role || !site_id) {
      return NextResponse.json({
        success: false,
        message: '모든 필수 필드를 입력해주세요.'
      }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Auth 사용자 업데이트 (user_metadata 포함)
    const authUpdateData: any = {};

    // 이메일 업데이트
    if (email) {
      authUpdateData.email = email;
    }

    // 전화번호 업데이트
    if (phone) {
      const cleanedPhone = phone.replace(/[^0-9]/g, '');

      if (!validateKoreanPhoneInput(cleanedPhone)) {
        return NextResponse.json({
          success: false,
          message: '올바른 전화번호 형식이 아닙니다. (예: 01012345678)'
        }, { status: 400 });
      }

      authUpdateData.phone = formatPhoneForDB(cleanedPhone);
    }

    // user_metadata 업데이트 (전체 프로필 정보)
    const userMetadata: UserMetadata = {
      display_name: user_id || '',
      name: name,
      role: role,
      site_id: site_id,
      is_active: is_active ?? true,
    };
    authUpdateData.user_metadata = userMetadata;

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      authUpdateData
    );

    if (authError) {
      console.error('Auth 사용자 업데이트 오류:', authError);
      return NextResponse.json({
        success: false,
        message: 'Auth 사용자 정보 업데이트에 실패했습니다.'
      }, { status: 500 });
    }

    // 2. user_profiles도 업데이트 (점진적 전환 기간 동안 유지)
    const updateProfileData: any = {
      name,
      role,
      site_id,
      is_active,
      updated_at: new Date().toISOString()
    };

    if (user_id !== undefined) {
      updateProfileData.user_id = user_id;
    }

    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update(updateProfileData)
      .eq('id', userId);

    if (profileError) {
      // user_profiles 업데이트 실패는 경고만 (user_metadata가 주요 소스)
      console.warn('user_profiles 업데이트 실패 (폴백용):', profileError);
    }

    return NextResponse.json({
      success: true,
      message: '사용자 정보가 성공적으로 업데이트되었습니다.'
    });

  } catch (error) {
    console.error('사용자 업데이트 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

/**
 * DELETE: 사용자 삭제
 * - Auth 사용자와 user_profiles 모두 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. user_profiles 삭제 (점진적 전환 기간)
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.warn('user_profiles 삭제 실패:', profileError);
      // 계속 진행 (user_profiles가 없어도 auth 사용자는 삭제)
    }

    // 2. Auth 사용자 삭제
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Auth 사용자 삭제 오류:', authError);
      return NextResponse.json({
        success: false,
        message: 'Auth 사용자 삭제에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '사용자가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('사용자 삭제 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

/**
 * PATCH: 사용자 활성화/비활성화 토글
 * - user_metadata와 user_profiles 모두 업데이트
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const body = await request.json();
    const { is_active } = body;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. 현재 user_metadata 조회
    const { data: { user: authUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (getUserError || !authUser) {
      console.error('사용자 조회 오류:', getUserError);
      return NextResponse.json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 2. user_metadata 업데이트
    const currentMetadata = authUser.user_metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      is_active
    };

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { user_metadata: updatedMetadata }
    );

    if (authError) {
      console.error('Auth 사용자 상태 업데이트 오류:', authError);
      return NextResponse.json({
        success: false,
        message: '사용자 상태 업데이트에 실패했습니다.'
      }, { status: 500 });
    }

    // 3. user_profiles도 업데이트 (점진적 전환 기간)
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileError) {
      console.warn('user_profiles 상태 업데이트 실패 (폴백용):', profileError);
    }

    return NextResponse.json({
      success: true,
      message: `사용자가 성공적으로 ${is_active ? '활성화' : '비활성화'}되었습니다.`
    });

  } catch (error) {
    console.error('사용자 상태 업데이트 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
