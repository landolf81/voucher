import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { isValidUserMetadata } from '@/lib/types/auth';

// 사용자 생성 스키마
const createUserSchema = z.object({
  email: z.string().email('올바른 이메일 형식을 입력해주세요.').optional(),
  phone: z.string().regex(/^010\d{8}$/, '올바른 휴대폰 번호를 입력해주세요.'),
  name: z.string().min(2, '이름은 2자 이상이어야 합니다.').max(10, '이름은 10자 이하여야 합니다.'),
  display_name: z.string().min(2, '사용자 ID는 2자 이상이어야 합니다.').max(20, '사용자 ID는 20자 이하여야 합니다.'),
  role: z.enum(['admin', 'staff', 'viewer', 'part_time', 'inquiry'], { required_error: '권한을 선택해주세요.' }),
  site_id: z.string().min(1, '사업장을 선택해주세요.')
});

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

// 관리자 권한 확인 함수 (auth.users에서 확인)
async function checkAdminAccess(supabase: any, userId: string) {
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  return authUser?.user?.user_metadata?.role === 'admin';
}

// GET: 모든 사용자 목록 조회 (관리자만)
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    const isAdmin = await checkAdminAccess(supabaseAdmin, user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // auth.users에서 모든 사용자 조회
    const [authUsersResult, sitesResult] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers(),
      supabaseAdmin.from('sites').select('id, site_name').order('site_name')
    ]);

    if (authUsersResult.error) {
      console.error('Auth 사용자 조회 오류:', authUsersResult.error);
      return NextResponse.json(
        { success: false, message: '사용자 목록 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    const siteMap = new Map((sitesResult.data || []).map((s: { id: string; site_name: string }) => [s.id, s.site_name]));

    // 모든 사용자 변환 (불완전한 metadata도 포함)
    const users = authUsersResult.data.users
      .map(authUser => {
        const metadata = authUser.user_metadata || {};
        const hasCompleteProfile = isValidUserMetadata(authUser.user_metadata);
        return {
          id: authUser.id,
          display_name: metadata.display_name || '',
          name: metadata.name || authUser.email?.split('@')[0] || '미설정',
          role: metadata.role || 'viewer',
          site_id: metadata.site_id || '',
          site_name: metadata.site_id ? siteMap.get(metadata.site_id) : null,
          is_active: metadata.is_active !== false,
          email: authUser.email,
          phone: authUser.phone,
          created_at: authUser.created_at,
          has_complete_profile: hasCompleteProfile
        };
      })
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return NextResponse.json({
      success: true,
      data: {
        users,
        sites: sitesResult.data || []
      }
    });

  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 새 사용자 생성 (관리자만)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabaseAdmin = getSupabaseAdmin();

    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    const isAdmin = await checkAdminAccess(supabaseAdmin, user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 입력 검증
    const validation = createUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: '입력 데이터가 올바르지 않습니다.',
          errors: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { email, phone, name, display_name, role, site_id } = validation.data;

    // 전화번호 형식 변환 (010XXXXXXXX → +8210XXXXXXXX)
    const formattedPhone = phone.startsWith('+82')
      ? phone
      : `+82${phone.replace(/^0/, '')}`;

    // Auth 사용자 생성 (user_metadata에 프로필 정보 포함)
    const { data: newAuthUser, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email,
      phone: formattedPhone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        display_name,
        name,
        role,
        site_id,
        is_active: true
      }
    });

    if (authCreateError) {
      console.error('Auth 사용자 생성 오류:', authCreateError);
      return NextResponse.json(
        {
          success: false,
          message: authCreateError.message.includes('already registered')
            ? '이미 등록된 이메일 또는 전화번호입니다.'
            : '사용자 생성에 실패했습니다.'
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '사용자가 성공적으로 생성되었습니다.',
      data: {
        id: newAuthUser.user.id,
        display_name,
        name,
        role,
        site_id,
        is_active: true,
        email: newAuthUser.user.email,
        phone: newAuthUser.user.phone
      }
    });

  } catch (error) {
    console.error('사용자 생성 오류:', error);
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
