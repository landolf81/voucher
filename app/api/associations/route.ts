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

// 영농회 등록 스키마
const createAssociationSchema = z.object({
  name: z.string().min(1, '영농회명을 입력해주세요.').max(100),
  short_code: z.string().max(20).optional(),
  chairman_name: z.string().optional(),           // 영농회장
  women_chairman_name: z.string().optional(),     // 부녀회장
  status: z.enum(['active', 'inactive']).default('active')
});

// GET: 영농회 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status');
    const site_id = searchParams.get('site_id');

    let query = supabase
      .from('associations')
      .select('*')
      .order('name');

    if (status) {
      query = query.eq('status', status);
    }

    const { data: associations, error } = await query;

    if (error) {
      // 테이블이 없는 경우 빈 배열 반환
      if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
        console.warn('associations 테이블이 존재하지 않습니다.');
        return NextResponse.json({
          success: true,
          data: []
        });
      }
      console.error('영농회 목록 조회 오류:', error);
      return NextResponse.json(
        { success: false, message: '영농회 목록 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: associations || []
    });

  } catch (error) {
    console.error('영농회 목록 조회 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 새 영농회 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 입력 검증
    const validation = createAssociationSchema.safeParse(body);
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

    const data = validation.data;
    const supabase = getSupabaseAdmin();

    const { data: newAssociation, error } = await supabase
      .from('associations')
      .insert([{
        name: data.name,
        short_code: data.short_code || null,
        chairman_name: data.chairman_name || null,
        women_chairman_name: data.women_chairman_name || null,
        status: data.status
      }])
      .select()
      .single();

    if (error) {
      console.error('영농회 등록 오류:', error);

      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, message: '이미 존재하는 영농회명 또는 코드입니다.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, message: '영농회 등록에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '영농회가 성공적으로 등록되었습니다.',
      data: newAssociation
    });

  } catch (error) {
    console.error('영농회 등록 오류:', error);
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
