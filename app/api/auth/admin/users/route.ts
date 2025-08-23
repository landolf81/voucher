import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 사용자 생성 스키마
const createUserSchema = z.object({
  email: z.string().email('올바른 이메일 형식을 입력해주세요.').optional(),
  phone: z.string().regex(/^010\d{8}$/, '올바른 휴대폰 번호를 입력해주세요.'),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다.'),
  name: z.string().min(2, '이름은 2자 이상이어야 합니다.').max(10, '이름은 10자 이하여야 합니다.'),
  role: z.enum(['admin', 'staff', 'viewer', 'part_time'], { required_error: '권한을 선택해주세요.' }),
  site_id: z.string().min(1, '사업장을 선택해주세요.')
});

// 관리자 권한 확인 함수
async function checkAdminAccess(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();
    
  return profile?.role === 'admin';
}

// GET: 모든 사용자 목록 조회 (관리자만)
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 인증된 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: '인증이 필요합니다.'
        },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    const isAdmin = await checkAdminAccess(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          message: '관리자 권한이 필요합니다.'
        },
        { status: 403 }
      );
    }

    // 모든 사용자 프로필 조회
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        sites (
          id,
          site_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('사용자 목록 조회 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '사용자 목록 조회에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    // auth.users에서 이메일/휴대폰 정보 가져오기
    const { data: authUsers, error: authError2 } = await supabase.auth.admin.listUsers();
    
    if (authError2) {
      console.error('Auth 사용자 조회 오류:', authError2);
    }

    // 프로필과 auth 정보 매핑
    const usersWithAuth = profiles.map(profile => {
      const authUser = authUsers?.users?.find(au => au.id === profile.id);
      return {
        ...profile,
        email: authUser?.email,
        phone: authUser?.phone,
        phone_masked: authUser?.phone ? 
          `${authUser.phone.slice(0, 3)}-****-${authUser.phone.slice(-4)}` : 
          '***-****-****'
      };
    });

    // 사이트 목록도 함께 반환
    const { data: sites } = await supabase
      .from('sites')
      .select('*')
      .order('site_name');

    return NextResponse.json({
      success: true,
      data: {
        users: usersWithAuth,
        sites: sites || []
      }
    });

  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// POST: 새 사용자 생성 (관리자만)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 인증된 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: '인증이 필요합니다.'
        },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    const isAdmin = await checkAdminAccess(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          message: '관리자 권한이 필요합니다.'
        },
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

    const { email, phone, password, name, role, site_id } = validation.data;

    // 전화번호 형식 변환 (010XXXXXXXX → +8210XXXXXXXX)
    const formattedPhone = phone.startsWith('+82') 
      ? phone 
      : `+82${phone.replace(/^0/, '')}`;

    // Auth 사용자 생성
    const { data: newAuthUser, error: authCreateError } = await supabase.auth.admin.createUser({
      email,
      phone: formattedPhone,
      password,
      email_confirm: true,
      phone_confirm: true
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

    // 프로필 생성
    const { data: newProfile, error: profileError } = await supabase
      .from('user_profiles')
      .insert([{
        id: newAuthUser.user.id,
        name,
        role,
        site_id,
        is_active: true
      }])
      .select()
      .single();

    if (profileError) {
      console.error('프로필 생성 오류:', profileError);
      
      // Auth 사용자 삭제 (롤백)
      await supabase.auth.admin.deleteUser(newAuthUser.user.id);
      
      return NextResponse.json(
        {
          success: false,
          message: '프로필 생성에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '사용자가 성공적으로 생성되었습니다.',
      data: {
        ...newProfile,
        email: newAuthUser.user.email,
        phone: newAuthUser.user.phone
      }
    });

  } catch (error) {
    console.error('사용자 생성 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
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