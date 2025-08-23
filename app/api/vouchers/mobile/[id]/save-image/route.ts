import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 모바일 이미지 저장 스키마
const mobileImageSchema = z.object({
  mobile_image: z.string().min(1, '모바일 이미지가 필요합니다.')
});

// POST: 모바일 교환권 이미지 저장
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: voucherId } = await params;
    const body = await request.json();

    console.log('모바일 교환권 이미지 저장 API 호출, voucher_id:', voucherId);

    // 입력 검증
    const validation = mobileImageSchema.safeParse(body);
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

    const { mobile_image } = validation.data;

    // Supabase 사용
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // 교환권 조회
    const { data: voucher, error: fetchError } = await supabase
      .from('vouchers')
      .select('id, serial_no')
      .eq('id', voucherId)
      .single();

    if (fetchError || !voucher) {
      console.error('교환권 조회 오류:', fetchError);
      return NextResponse.json(
        {
          success: false,
          message: '교환권을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    // 모바일 이미지 업데이트
    const { error: updateError } = await supabase
      .from('vouchers')
      .update({ 
        mobile_image: mobile_image,
        updated_at: new Date().toISOString()
      })
      .eq('id', voucherId);

    if (updateError) {
      console.error('모바일 이미지 저장 오류:', updateError);
      return NextResponse.json(
        {
          success: false,
          message: '이미지 저장 중 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }

    // 감사 로그 기록
    await supabase
      .from('audit_logs')
      .insert({
        voucher_id: voucherId,
        action: 'mobile_image_saved',
        details: {
          serial_no: voucher.serial_no,
          image_size: mobile_image.length,
          saved_at: new Date().toISOString()
        }
      });

    console.log(`모바일 이미지 저장 완료: ${voucher.serial_no}`);

    return NextResponse.json({
      success: true,
      message: '모바일 이미지가 저장되었습니다.',
      voucher_id: voucherId
    });

  } catch (error) {
    console.error('모바일 교환권 이미지 저장 오류:', error);
    
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