import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 프로필 업데이트 스키마
const updateProfileSchema = z.object({
  name: z.string().min(2, '이름은 2자 이상이어야 합니다.').max(10, '이름은 10자 이하여야 합니다.').optional(),
  role: z.enum(['admin', 'staff', 'viewer', 'part_time']).optional(),
  site_id: z.string().min(1, '사업장을 선택해주세요.').optional(),
  is_active: z.boolean().optional()
});

// GET: 현재 사용자 프로필 조회
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

    // 사용자 프로필 조회 (사이트 정보 포함)
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        sites (
          id,
          site_name,
          address
        )
      `)
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('프로필 조회 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '프로필을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...profile,
        email: user.email,
        phone: user.phone,
        auth_id: user.id
      }
    });

  } catch (error) {
    console.error('프로필 조회 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// PUT: 사용자 프로필 수정
export async function PUT(request: NextRequest) {
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

    // 입력 검증
    const validation = updateProfileSchema.safeParse(body);
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

    const updates = validation.data;

    // 프로필 업데이트
    const { data: updatedProfile, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error('프로필 수정 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '프로필 수정에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '프로필이 성공적으로 수정되었습니다.',
      data: updatedProfile
    });

  } catch (error) {
    console.error('프로필 수정 오류:', error);
    
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
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}