import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getMobileRenderer } from '@/lib/mobile-voucher-renderer';
import { z } from 'zod';

// 모바일 이미지 생성 스키마
const mobileImageSchema = z.object({
  voucher_id: z.string().uuid('유효하지 않은 교환권 ID입니다.'),
  template_id: z.string().uuid('유효하지 않은 템플릿 ID입니다.'),
  width: z.number().positive().max(1000).optional().default(400),
  height: z.number().positive().max(1000).optional().default(400),
  format: z.enum(['png', 'jpeg']).optional().default('png'),
  quality: z.number().min(10).max(100).optional().default(90)
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('모바일 이미지 생성 API 호출:', {
      voucher_id: body.voucher_id,
      template_id: body.template_id
    });

    // 입력 검증
    const validation = mobileImageSchema.safeParse(body);
    if (!validation.success) {
      console.error('입력 검증 실패:', validation.error.errors);
      return NextResponse.json(
        {
          success: false,
          message: '입력 정보가 올바르지 않습니다.',
          errors: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { voucher_id, template_id, width, height, format, quality } = validation.data;

    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 교환권 데이터 조회
    const { data: voucher, error: voucherError } = await supabase
      .from('vouchers')
      .select('*')
      .eq('id', voucher_id)
      .single();

    if (voucherError || !voucher) {
      console.error('교환권 조회 오류:', voucherError);
      return NextResponse.json(
        {
          success: false,
          message: '교환권을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    // 모바일 렌더러 인스턴스 가져오기
    const renderer = getMobileRenderer();

    // 템플릿 데이터 가져오기
    const template = await renderer.getTemplate(template_id);
    if (!template) {
      return NextResponse.json(
        {
          success: false,
          message: '템플릿을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    // 교환권 데이터 변환
    const voucherData = {
      id: voucher.id,
      serial_no: voucher.serial_no,
      amount: voucher.amount,
      association: voucher.association,
      name: voucher.name,
      member_id: voucher.member_id,
      issued_at: voucher.issued_at
    };

    // 렌더링 옵션 설정
    const renderOptions = {
      width,
      height,
      format,
      quality,
      background: true
    };

    // 이미지 렌더링
    const imageBuffer = await renderer.renderVoucher(voucherData, template, renderOptions);

    // 이미지 파일명 생성
    const filename = `voucher_${voucher.serial_no}.${format}`;

    // Content-Type 설정
    const contentType = format === 'jpeg' ? 'image/jpeg' : 'image/png';

    // 응답 헤더 설정
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    headers.set('Content-Length', imageBuffer.length.toString());
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    // 감사 로그 기록 (비동기, 실패해도 응답에 영향 없음)
    (async () => {
      try {
        await supabase
          .from('audit_logs')
          .insert({
            action: 'mobile_image_download',
            voucher_id: voucher.id,
            details: {
              serial_no: voucher.serial_no,
              template_id,
              format,
              width,
              height
            }
          });
        console.log('Audit log recorded');
      } catch (error: any) {
        console.error('Audit log failed:', error);
      }
    })();

    return new NextResponse(imageBuffer as BodyInit, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('모바일 이미지 생성 API 오류:', error);
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}