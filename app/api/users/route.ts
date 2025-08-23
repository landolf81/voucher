import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 사용자 등록 스키마
const createUserSchema = z.object({
  user_id: z.string().min(3, '사용자 ID는 3자 이상이어야 합니다.').max(20, '사용자 ID는 20자 이하여야 합니다.'),
  email: z.string().email('올바른 이메일 형식을 입력해주세요.').optional(),
  name: z.string().min(2, '이름은 2자 이상이어야 합니다.').max(10, '이름은 10자 이하여야 합니다.'),
  phone: z.string().regex(/^010\d{8}$/, '올바른 휴대폰 번호를 입력해주세요.'),
  role: z.enum(['admin', 'staff', 'viewer', 'part_time'], { required_error: '권한을 선택해주세요.' }),
  site_id: z.string().min(1, '사업장을 선택해주세요.')
});

// 사용자 수정 스키마
const updateUserSchema = z.object({
  email: z.string().email('올바른 이메일 형식을 입력해주세요.').optional(),
  name: z.string().min(2, '이름은 2자 이상이어야 합니다.').max(10, '이름은 10자 이하여야 합니다.').optional(),
  phone: z.string().regex(/^010\d{8}$/, '올바른 휴대폰 번호를 입력해주세요.').optional(),
  role: z.enum(['admin', 'staff', 'viewer', 'part_time']).optional(),
  site_id: z.string().min(1, '사업장을 선택해주세요.').optional(),
  is_active: z.boolean().optional()
});

// GET: 사용자 목록 조회
export async function GET(request: NextRequest) {
  try {
    console.log('사용자 목록 조회 API 호출');

    // Supabase 사용
    console.log('Supabase 사용 - 사용자 목록 조회');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 사용자와 매장 정보를 조인하여 조회
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(`
        *,
        sites (
          id,
          site_name
        )
      `)
      .order('role')
      .order('user_id');

    if (usersError) {
      console.error('Supabase 사용자 조회 오류:', usersError);
      return NextResponse.json(
        {
          success: false,
          message: '사용자 목록 조회에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    // 매장 목록도 별도 조회
    const { data: sites, error: sitesError } = await supabase
      .from('sites')
      .select('*')
      .order('site_name');

    return NextResponse.json({
      success: true,
      data: {
        users: users || [],
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

// POST: 새 사용자 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('사용자 등록 API 호출:', body.user_id);

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

    const { user_id, email, name, phone, role, site_id } = validation.data;

    // Supabase 사용
    console.log('Supabase 사용 - 사용자 등록');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{
        user_id,
        email,
        name,
        phone,
        role,
        site_id
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase 사용자 등록 오류:', error);
      
      // 중복 오류 처리
      if (error.code === '23505') {
        return NextResponse.json(
          {
            success: false,
            message: '이미 존재하는 사용자 ID 또는 전화번호입니다.'
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          message: '사용자 등록에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '사용자가 성공적으로 등록되었습니다.',
      data: newUser
    });

  } catch (error) {
    console.error('사용자 등록 오류:', error);
    
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