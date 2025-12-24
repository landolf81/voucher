import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { formatPhoneForDB, validateKoreanPhoneInput } from '@/lib/phone-utils';
import { isValidUserMetadata, type UserMetadata } from '@/lib/types/auth';

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

/**
 * GET: 사용자 프로필 조회
 * - auth.users.user_metadata만 사용
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const supabaseAdmin = getSupabaseAdmin();

    // auth.users에서 사용자 조회
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (authError || !authUser) {
      console.error('Auth 사용자 조회 오류:', authError);
      return NextResponse.json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    const metadata = authUser.user_metadata;

    if (!isValidUserMetadata(metadata)) {
      return NextResponse.json({
        success: false,
        message: '사용자 프로필 정보가 없습니다.'
      }, { status: 404 });
    }

    // sites 조회
    const { data: sites } = await supabaseAdmin
      .from('sites')
      .select('id, site_name');

    const sitesMap = new Map((sites || []).map((s: { id: string; site_name: string }) => [s.id, s.site_name]));

    return NextResponse.json({
      success: true,
      data: {
        id: authUser.id,
        display_name: metadata.display_name,
        user_id: metadata.display_name,
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
 * - auth.users.user_metadata만 업데이트
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const body = await request.json();
    const { email, phone, name, role, site_id, is_active, user_id } = body;

    if (!name || !role || !site_id) {
      return NextResponse.json({
        success: false,
        message: '모든 필수 필드를 입력해주세요.'
      }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const authUpdateData: any = {};

    if (email) {
      authUpdateData.email = email;
    }

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

    return NextResponse.json({
      success: true,
      message: '사용자 정보가 성공적으로 업데이트되었습니다.',
      data: { id: userId, ...userMetadata }
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
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const supabaseAdmin = getSupabaseAdmin();

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
      message: '사용자가 성공적으로 삭제되었습니다.',
      data: { id: userId }
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
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const body = await request.json();
    const { is_active } = body;

    const supabaseAdmin = getSupabaseAdmin();

    const { data: { user: authUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (getUserError || !authUser) {
      console.error('사용자 조회 오류:', getUserError);
      return NextResponse.json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      }, { status: 404 });
    }

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

    return NextResponse.json({
      success: true,
      message: `사용자가 성공적으로 ${is_active ? '활성화' : '비활성화'}되었습니다.`,
      data: { id: userId, is_active }
    });

  } catch (error) {
    console.error('사용자 상태 업데이트 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
