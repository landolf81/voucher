import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
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

// 프로필 업데이트 스키마
const updateProfileSchema = z.object({
  name: z.string().min(2, '이름은 2자 이상이어야 합니다.').max(10, '이름은 10자 이하여야 합니다.').optional(),
  role: z.enum(['admin', 'staff', 'viewer', 'part_time', 'inquiry']).optional(),
  site_id: z.string().min(1, '사업장을 선택해주세요.').optional(),
  is_active: z.boolean().optional()
});

// GET: 현재 사용자 프로필 조회
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const supabaseAdmin = getSupabaseAdmin();

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const metadata = user.user_metadata;

    if (!isValidUserMetadata(metadata)) {
      return NextResponse.json(
        { success: false, message: '프로필을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // sites 정보 조회
    const { data: site } = await supabaseAdmin
      .from('sites')
      .select('id, site_name, address')
      .eq('id', metadata.site_id)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        display_name: metadata.display_name,
        user_id: metadata.display_name,
        name: metadata.name,
        role: metadata.role,
        site_id: metadata.site_id,
        sites: site,
        is_active: metadata.is_active ?? true,
        email: user.email,
        phone: user.phone,
        auth_id: user.id,
        oauth_provider: metadata.oauth_provider,
        oauth_provider_id: metadata.oauth_provider_id,
        oauth_linked_at: metadata.oauth_linked_at
      }
    });

  } catch (error) {
    console.error('프로필 조회 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PUT: 사용자 프로필 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const supabaseAdmin = getSupabaseAdmin();

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const validation = updateProfileSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: '입력 데이터가 올바르지 않습니다.',
          errors: validation.error.issues
        },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // user_metadata 업데이트
    const currentMetadata = user.user_metadata || {};
    const updatedMetadata: Partial<UserMetadata> = {
      ...currentMetadata,
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.role !== undefined && { role: updates.role }),
      ...(updates.site_id !== undefined && { site_id: updates.site_id }),
      ...(updates.is_active !== undefined && { is_active: updates.is_active }),
    };

    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { user_metadata: updatedMetadata }
    );

    if (updateAuthError) {
      console.error('user_metadata 수정 오류:', updateAuthError);
      return NextResponse.json(
        { success: false, message: '프로필 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '프로필이 성공적으로 수정되었습니다.',
      data: updatedMetadata
    });

  } catch (error) {
    console.error('프로필 수정 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// OPTIONS 요청 처리 (CORS)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
