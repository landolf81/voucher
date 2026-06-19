import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Service role client for bypassing RLS
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

// 영농회 수정 스키마
const updateAssociationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  short_code: z.string().max(20).optional(),
  chairman_name: z.string().optional(),           // 영농회장
  women_chairman_name: z.string().optional(),     // 부녀회장
  status: z.enum(['active', 'inactive']).optional()
});

// GET: 특정 영농회 조회
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    const { data: association, error } = await supabase
      .from('associations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('영농회 조회 오류:', error);
      return NextResponse.json(
        { success: false, message: '영농회를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: association
    });

  } catch (error) {
    console.error('영농회 조회 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PUT: 영농회 수정
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // 입력 검증
    const validation = updateAssociationSchema.safeParse(body);
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

    const updateData = validation.data;
    const supabase = getSupabaseAdmin();

    // 존재 여부 확인
    const { data: existing, error: findError } = await supabase
      .from('associations')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return NextResponse.json(
        { success: false, message: '영농회를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 수정
    const { data: updated, error: updateError } = await supabase
      .from('associations')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('영농회 수정 오류:', updateError);

      if (updateError.code === '23505') {
        return NextResponse.json(
          { success: false, message: '이미 존재하는 영농회명 또는 코드입니다.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, message: '영농회 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '영농회가 성공적으로 수정되었습니다.',
      data: updated
    });

  } catch (error) {
    console.error('영농회 수정 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 영농회 삭제
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    const { error: deleteError } = await supabase
      .from('associations')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('영농회 삭제 오류:', deleteError);

      if (deleteError.code === '23503') {
        return NextResponse.json(
          { success: false, message: '해당 영농회에 소속된 조합원이 있어 삭제할 수 없습니다.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, message: '영농회 삭제에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '영농회가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('영농회 삭제 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// OPTIONS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
