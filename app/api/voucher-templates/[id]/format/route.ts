import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 필드 배치 정보 스키마
const fieldPositionSchema = z.object({
  field: z.enum(['voucher_name', 'member_id', 'name', 'amount', 'expires_at', 'usage_location', 'serial_no', 'issued_at', 'qr_code', 'barcode']),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  fontSize: z.number(),
  fontColor: z.string(),
  fontWeight: z.enum(['normal', 'bold']),
  textAlign: z.enum(['left', 'center', 'right'])
});

// 템플릿 서식 업데이트 스키마
const templateFormatSchema = z.object({
  template_image: z.string().min(1, '템플릿 이미지가 필요합니다.'),
  image_width: z.number().positive('이미지 너비는 0보다 커야 합니다.'),
  image_height: z.number().positive('이미지 높이는 0보다 커야 합니다.'),
  field_positions: z.array(fieldPositionSchema).min(1, '최소 하나의 필드 배치가 필요합니다.')
});

// PUT: 템플릿 인쇄 서식 업데이트
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: templateId } = await params;
    const body = await request.json();

    console.log('템플릿 서식 업데이트 API 호출, template_id:', templateId);

    // 입력 검증
    const validation = templateFormatSchema.safeParse(body);
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

    const { template_image, image_width, image_height, field_positions } = validation.data;

    // Supabase 사용
    console.log('Supabase 사용 - 템플릿 서식 업데이트');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: updatedTemplate, error } = await supabase
      .from('voucher_templates')
      .update({
        template_image,
        image_width,
        image_height,
        field_positions,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)
      .select()
      .single();

    if (error) {
      console.error('Supabase 템플릿 서식 업데이트 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: error.code === 'PGRST116' ? '해당 템플릿을 찾을 수 없습니다.' : '서식 저장에 실패했습니다.'
        },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '인쇄 서식이 성공적으로 저장되었습니다.',
      data: updatedTemplate
    });
  } catch (error) {
    console.error('템플릿 서식 업데이트 오류:', error);
    
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
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}