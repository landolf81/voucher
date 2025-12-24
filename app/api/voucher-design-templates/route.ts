import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 필드 배치 설정 스키마
const fieldPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  color: z.string().optional()
});

// 디자인 템플릿 생성 스키마
const designTemplateCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  a4_image_url: z.string().optional(),  // URL validation removed, optional
  a4_image_width: z.number().optional().default(210),
  a4_image_height: z.number().optional().default(297),
  mobile_image_url: z.string().optional(),  // URL validation removed, optional
  mobile_image_size: z.number().optional().default(400),
  a4_field_positions: z.record(fieldPositionSchema).optional().default({}),
  mobile_field_positions: z.record(fieldPositionSchema).optional().default({}),
  default_font_family: z.string().optional().default('Pretendard'),
  default_font_size: z.number().optional().default(12),
  default_text_color: z.string().optional().default('#000000'),
  // New fields for Unlayer editor
  template_html: z.string().optional(),
  template_css: z.string().optional(),
  grapesjs_data: z.any().optional(),
  mobile_template_html: z.string().optional(),
  mobile_template_css: z.string().optional(),
  mobile_grapesjs_data: z.any().optional()
});

// 디자인 템플릿 조회 스키마
const designTemplateSearchSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
  is_active: z.boolean().optional()
});

// GET: 디자인 템플릿 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const is_active = searchParams.get('is_active') === 'true' ? true : 
                     searchParams.get('is_active') === 'false' ? false : undefined;

    console.log('디자인 템플릿 조회 API 호출:', { page, limit, is_active });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 총 개수 조회를 위한 쿼리
    let countQuery = supabase
      .from('voucher_design_templates')
      .select('*', { count: 'exact', head: true });

    // 데이터 조회를 위한 쿼리
    let dataQuery = supabase
      .from('voucher_design_templates')
      .select('*')
      .order('created_at', { ascending: false });

    // 필터 적용
    if (is_active !== undefined) {
      countQuery = countQuery.eq('is_active', is_active);
      dataQuery = dataQuery.eq('is_active', is_active);
    }

    // 페이징 적용
    const offset = (page - 1) * limit;
    dataQuery = dataQuery.range(offset, offset + limit - 1);

    // 병렬로 실행
    const [{ count }, { data: templates, error }] = await Promise.all([
      countQuery,
      dataQuery
    ]);

    if (error) {
      console.error('Supabase 디자인 템플릿 조회 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '디자인 템플릿 조회에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: templates || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('디자인 템플릿 조회 API 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// POST: 디자인 템플릿 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('디자인 템플릿 생성 API 호출:', body);

    // 입력 검증
    const validation = designTemplateCreateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: '입력 정보가 올바르지 않습니다.',
          errors: validation.error.errors
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 디자인 템플릿 생성
    const { data: newTemplate, error } = await supabase
      .from('voucher_design_templates')
      .insert([data])
      .select()
      .single();

    if (error) {
      console.error('Supabase 디자인 템플릿 생성 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '디자인 템플릿 생성에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    console.log('디자인 템플릿 생성 완료:', newTemplate.id);

    return NextResponse.json({
      success: true,
      message: '디자인 템플릿이 생성되었습니다.',
      data: newTemplate
    });

  } catch (error) {
    console.error('디자인 템플릿 생성 API 오류:', error);
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