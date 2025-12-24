import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 교환권 수정 스키마
const voucherUpdateSchema = z.object({
  serial_no: z.string().optional(),
  amount: z.number().positive().int().optional(),
  association: z.string().min(1).max(100).optional(),
  member_id: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(50).optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '생년월일 형식이 올바르지 않습니다.').optional(),
  phone: z.string().optional(),
  status: z.enum(['registered', 'issued', 'used', 'recalled', 'disposed']).optional(),
  notes: z.string().optional()
});

// GET: 특정 교환권 조회
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: voucherId } = await params;
    console.log('교환권 조회 API 호출, voucher_id:', voucherId);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: voucher, error } = await supabase
      .from('vouchers')
      .select('*')
      .eq('id', voucherId)
      .single();

    if (error || !voucher) {
      console.error('Supabase 교환권 조회 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '교환권을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: voucher
    });

  } catch (error) {
    console.error('교환권 조회 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// PUT: 교환권 정보 수정
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: voucherId } = await params;
    const body = await request.json();

    console.log('교환권 수정 API 호출, voucher_id:', voucherId);

    // 입력 검증
    const validation = voucherUpdateSchema.safeParse(body);
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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 일련번호 변경 시 중복 확인
    if (updates.serial_no) {
      const { data: existingVoucher } = await supabase
        .from('vouchers')
        .select('id')
        .eq('serial_no', updates.serial_no)
        .neq('id', voucherId)
        .maybeSingle();

      if (existingVoucher) {
        return NextResponse.json(
          {
            success: false,
            message: '이미 존재하는 일련번호입니다.'
          },
          { status: 409 }
        );
      }
    }

    const { data: updatedVoucher, error } = await supabase
      .from('vouchers')
      .update(updates)
      .eq('id', voucherId)
      .select()
      .single();

    if (error) {
      console.error('Supabase 교환권 수정 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: error.code === 'PGRST116' ? '교환권을 찾을 수 없습니다.' : '교환권 수정에 실패했습니다.'
        },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '교환권 정보가 성공적으로 수정되었습니다.',
      data: updatedVoucher
    });

  } catch (error) {
    console.error('교환권 수정 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// DELETE: 교환권 삭제
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: voucherId } = await params;
    console.log('교환권 삭제 API 호출, voucher_id:', voucherId);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 사용된 교환권은 삭제 불가
    const { data: voucher } = await supabase
      .from('vouchers')
      .select('status, serial_no')
      .eq('id', voucherId)
      .single();

    if (!voucher) {
      return NextResponse.json(
        {
          success: false,
          message: '교환권을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    if (['used', 'disposed'].includes(voucher.status)) {
      return NextResponse.json(
        {
          success: false,
          message: '사용되거나 폐기된 교환권은 삭제할 수 없습니다.'
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('vouchers')
      .delete()
      .eq('id', voucherId);

    if (error) {
      console.error('Supabase 교환권 삭제 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: error.code === 'PGRST116' ? '교환권을 찾을 수 없습니다.' : '교환권 삭제에 실패했습니다.'
        },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '교환권이 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('교환권 삭제 오류:', error);
    
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