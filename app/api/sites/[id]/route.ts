import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { z } from 'zod';

// 사업장 수정 스키마
const updateSiteSchema = z.object({
  site_name: z.string().min(1, '사업장명을 입력해주세요.').max(100, '사업장명은 100자 이하여야 합니다.').optional(),
  short_code: z.string().max(10, '코드는 10자 이하여야 합니다.').optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
  business_number: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional()
});

// GET: 특정 사업장 조회
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = supabaseServer();

    const { data: site, error } = await supabase
      .from('sites')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('사업장 조회 오류:', error);
      return NextResponse.json(
        { success: false, message: '사업장을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: site
    });

  } catch (error) {
    console.error('사업장 조회 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PUT: 사업장 수정
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // 입력 검증
    const validation = updateSiteSchema.safeParse(body);
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

    const updateData = validation.data;
    const supabase = supabaseServer();

    // 사업장 존재 여부 확인
    const { data: existingSite, error: findError } = await supabase
      .from('sites')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !existingSite) {
      return NextResponse.json(
        { success: false, message: '사업장을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 사업장 수정
    const { data: updatedSite, error: updateError } = await supabase
      .from('sites')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('사업장 수정 오류:', updateError);

      // 중복 오류 처리
      if (updateError.code === '23505') {
        return NextResponse.json(
          { success: false, message: '이미 존재하는 사업장명 또는 코드입니다.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, message: '사업장 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '사업장이 성공적으로 수정되었습니다.',
      data: updatedSite
    });

  } catch (error) {
    console.error('사업장 수정 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 사업장 삭제
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = supabaseServer();

    // 사업장 삭제
    const { error: deleteError } = await supabase
      .from('sites')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('사업장 삭제 오류:', deleteError);

      // 참조 무결성 오류 (다른 테이블에서 참조 중)
      if (deleteError.code === '23503') {
        return NextResponse.json(
          { success: false, message: '해당 사업장에 소속된 사용자 또는 조합원이 있어 삭제할 수 없습니다.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, message: '사업장 삭제에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '사업장이 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('사업장 삭제 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// OPTIONS 요청 처리 (CORS)
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
