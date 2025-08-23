import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 사용자 수정 스키마
const updateUserSchema = z.object({
  email: z.string().email('올바른 이메일 형식을 입력해주세요.').optional(),
  name: z.string().min(2, '이름은 2자 이상이어야 합니다.').max(10, '이름은 10자 이하여야 합니다.').optional(),
  phone: z.string().regex(/^010\d{8}$/, '올바른 휴대폰 번호를 입력해주세요.').optional(),
  role: z.enum(['admin', 'staff', 'viewer', 'part_time']).optional(),
  site_id: z.string().min(1, '사업장을 선택해주세요.').optional(),
  is_active: z.boolean().optional()
});

// GET: 특정 사용자 조회
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: userId } = await params;
    console.log('사용자 조회 API 호출, user_id:', userId);

    // Supabase 사용
    console.log('Supabase 사용 - 사용자 조회');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        sites (
          id,
          site_name
        )
      `)
      .eq('user_id', userId)
      .single();

    if (error || !user) {
      console.error('Supabase 사용자 조회 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '사용자를 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('사용자 조회 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// PUT: 사용자 정보 수정
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: userId } = await params;
    const body = await request.json();

    console.log('사용자 수정 API 호출, user_id:', userId);

    // 입력 검증
    const validation = updateUserSchema.safeParse(body);
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

    // Supabase 사용
    console.log('Supabase 사용 - 사용자 수정');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Supabase 사용자 수정 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: error.code === 'PGRST116' ? '사용자를 찾을 수 없습니다.' : '사용자 수정에 실패했습니다.'
        },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '사용자 정보가 성공적으로 수정되었습니다.',
      data: updatedUser
    });

  } catch (error) {
    console.error('사용자 수정 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// DELETE: 사용자 삭제
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: userId } = await params;
    console.log('사용자 삭제 API 호출, user_id:', userId);

    // Supabase 사용
    console.log('Supabase 사용 - 사용자 삭제');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Supabase 사용자 삭제 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: error.code === 'PGRST116' ? '사용자를 찾을 수 없습니다.' : '사용자 삭제에 실패했습니다.'
        },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '사용자가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('사용자 삭제 오류:', error);
    
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
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}