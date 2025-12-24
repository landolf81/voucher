import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 교환권 사용 등록 스키마
const useVoucherSchema = z.object({
  serial_no: z.string().min(1, '일련번호를 입력해주세요.'),
  usage_location: z.string().min(1, '사용처를 입력해주세요.'),
  notes: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('교환권 사용 등록 API 호출:', body);

    // 입력 검증
    const validation = useVoucherSchema.safeParse(body);
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

    const { serial_no, usage_location, notes } = validation.data;

    // Supabase 사용
    console.log('Supabase 사용 - 교환권 사용 등록');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 교환권 조회
    const { data: voucher, error: findError } = await supabase
      .from('vouchers')
      .select('*')
      .eq('serial_no', serial_no)
      .single();

    if (findError || !voucher) {
      return NextResponse.json(
        {
          success: false,
          message: '해당 일련번호의 교환권을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    // 교환권 상태 확인
    if (voucher.status === 'used') {
      return NextResponse.json(
        {
          success: false,
          message: '이미 사용된 교환권입니다.'
        },
        { status: 400 }
      );
    }

    if (voucher.status === 'recalled') {
      return NextResponse.json(
        {
          success: false,
          message: '회수된 교환권입니다.'
        },
        { status: 400 }
      );
    }

    if (voucher.status === 'expired') {
      return NextResponse.json(
        {
          success: false,
          message: '만료된 교환권입니다.'
        },
        { status: 400 }
      );
    }

    if (voucher.status !== 'issued' && voucher.status !== 'printed' && voucher.status !== 'delivered') {
      return NextResponse.json(
        {
          success: false,
          message: '사용할 수 없는 상태의 교환권입니다.'
        },
        { status: 400 }
      );
    }

    // 교환권 상태 업데이트
    const { error: updateError } = await supabase
      .from('vouchers')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        usage_location: usage_location,
        notes: notes || ''
      })
      .eq('id', voucher.id);

    if (updateError) {
      console.error('교환권 사용 업데이트 오류:', updateError);
      return NextResponse.json(
        {
          success: false,
          message: '교환권 사용 등록에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    // 감사 로그 추가
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        action: 'voucher_used',
        target_type: 'voucher',
        target_id: voucher.id,
        user_id: 'current_user', // 실제 구현에서는 세션에서 가져와야 함
        details: {
          serial_no: serial_no,
          usage_location: usage_location,
          notes: notes,
          previous_status: voucher.status,
          new_status: 'used'
        },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown'
      });

    if (auditError) {
      console.error('감사 로그 추가 오류:', auditError);
      // 감사 로그 실패는 전체 작업을 중단시키지 않음
    }

    console.log('교환권 사용 등록 완료:', {
      serial_no,
      usage_location,
      notes
    });

    return NextResponse.json({
      success: true,
      message: '교환권 사용이 성공적으로 등록되었습니다.',
      data: {
        serial_no: voucher.serial_no,
        used_at: new Date().toISOString(),
        usage_location: usage_location,
        notes: notes
      }
    });
  } catch (error) {
    console.error('교환권 사용 등록 오류:', error);
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