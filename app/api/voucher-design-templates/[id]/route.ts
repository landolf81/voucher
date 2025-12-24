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

// 디자인 템플릿 업데이트 스키마
const designTemplateUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  a4_image_url: z.string().optional(),
  a4_image_width: z.number().optional(),
  a4_image_height: z.number().optional(),
  mobile_image_url: z.string().optional(),
  mobile_image_size: z.number().optional(),
  a4_field_positions: z.record(fieldPositionSchema).optional(),
  mobile_field_positions: z.record(fieldPositionSchema).optional(),
  default_font_family: z.string().optional(),
  default_font_size: z.number().optional(),
  default_text_color: z.string().optional(),
  template_html: z.string().optional(),
  template_css: z.string().optional(),
  grapesjs_data: z.any().optional(),
  mobile_template_html: z.string().optional(),
  mobile_template_css: z.string().optional(),
  mobile_grapesjs_data: z.any().optional(),
  is_active: z.boolean().optional()
});

// GET: 특정 디자인 템플릿 조회
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: templateId } = await params;

    if (!templateId) {
      return NextResponse.json(
        { success: false, message: '템플릿 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: template, error } = await supabase
      .from('voucher_design_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      console.error('Supabase 디자인 템플릿 조회 오류:', error);
      return NextResponse.json(
        { success: false, message: '디자인 템플릿을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('디자인 템플릿 조회 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PUT: 디자인 템플릿 업데이트
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: templateId } = await params;
    const body = await request.json();

    console.log('디자인 템플릿 업데이트 API 호출:', templateId, body);

    if (!templateId) {
      return NextResponse.json(
        { success: false, message: '템플릿 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 입력 검증
    const validation = designTemplateUpdateSchema.safeParse(body);
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

    // 디자인 템플릿 업데이트
    const { data: updatedTemplate, error } = await supabase
      .from('voucher_design_templates')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)
      .select()
      .single();

    if (error) {
      console.error('Supabase 디자인 템플릿 업데이트 오류:', error);
      return NextResponse.json(
        { success: false, message: '디자인 템플릿 업데이트에 실패했습니다.' },
        { status: 500 }
      );
    }

    console.log('디자인 템플릿 업데이트 완료:', updatedTemplate.id);

    return NextResponse.json({
      success: true,
      message: '디자인 템플릿이 업데이트되었습니다.',
      data: updatedTemplate
    });

  } catch (error) {
    console.error('디자인 템플릿 업데이트 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 디자인 템플릿 삭제
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: templateId } = await params;

    if (!templateId) {
      return NextResponse.json(
        { success: false, message: '템플릿 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 디자인 템플릿 삭제
    const { error } = await supabase
      .from('voucher_design_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      console.error('Supabase 디자인 템플릿 삭제 오류:', error);
      return NextResponse.json(
        { success: false, message: '디자인 템플릿 삭제에 실패했습니다.' },
        { status: 500 }
      );
    }

    console.log('디자인 템플릿 삭제 완료:', templateId);

    return NextResponse.json({
      success: true,
      message: '디자인 템플릿이 삭제되었습니다.'
    });

  } catch (error) {
    console.error('디자인 템플릿 삭제 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}