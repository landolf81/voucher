import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 일괄 회수 스키마
const bulkRecallSchema = z.object({
  voucher_type: z.string().optional().default('all'), // 교환권 종류
  reason: z.string().optional().default('관리자에 의한 일괄 회수'), // 회수 사유
  retrieved_by: z.string().optional() // 회수자 ID
});

// POST: 미사용 교환권 일괄 회수 (관리자 전용)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('일괄 회수 API 호출:', body);

    // 입력 검증
    const validation = bulkRecallSchema.safeParse(body);
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

    const { voucher_type, reason, retrieved_by } = validation.data;
    let recalledCount = 0;
    const errors: string[] = [];
    const now = new Date().toISOString();

    // Supabase 사용
    console.log('Supabase 사용 - 일괄 회수');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    try {
      // 미사용 교환권 조회
      let query = supabase
        .from('vouchers')
        .select('id, serial_no')
        .eq('status', 'issued');

      // 교환권 종류별 필터링
      if (voucher_type && voucher_type !== 'all') {
        const typePrefix = voucher_type.toUpperCase();
        query = query.ilike('serial_no', `${typePrefix}%`);
      }

      const { data: unusedVouchers, error: selectError } = await query;

      if (selectError) {
        console.error('미사용 교환권 조회 오류:', selectError);
        return NextResponse.json(
          {
            success: false,
            message: '미사용 교환권 조회에 실패했습니다.'
          },
          { status: 500 }
        );
      }

      if (!unusedVouchers || unusedVouchers.length === 0) {
        return NextResponse.json(
          {
            success: true,
            message: '회수할 미사용 교환권이 없습니다.',
            recalledCount: 0,
            totalCount: 0,
            errorCount: 0
          }
        );
      }

      console.log(`일괄 회수 대상 교환권: ${unusedVouchers.length}개`);

      // 일괄 회수 처리
      const voucherIds = unusedVouchers.map((v: { id: string }) => v.id);
      const { data: updatedVouchers, error: updateError } = await supabase
        .from('vouchers')
        .update({
          status: 'recalled',
          recalled_at: now,
          notes: `${reason}, 회수자: ${retrieved_by}, 일괄회수`
        })
        .in('id', voucherIds)
        .select('id');

      if (updateError) {
        console.error('Supabase 일괄 회수 오류:', updateError);
        return NextResponse.json(
          {
            success: false,
            message: '일괄 회수에 실패했습니다.'
          },
          { status: 500 }
        );
      }

      recalledCount = updatedVouchers?.length || 0;

      // 회수되지 않은 교환권들 확인
      if (recalledCount < voucherIds.length) {
        const updatedIds = updatedVouchers?.map((v: { id: string }) => v.id) || [];
        const failedIds = voucherIds.filter(id => !updatedIds.includes(id));
        const failedVouchers = unusedVouchers.filter((v: { id: string; serial_no: string }) => failedIds.includes(v.id));
        
        failedVouchers.forEach((voucher: { serial_no: string }) => {
          errors.push(`교환권 ${voucher.serial_no}: 회수 실패`);
        });
      }
    } catch (error) {
      console.error('일괄 회수 처리 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '서버 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }

    console.log(`일괄 회수 완료: 성공 ${recalledCount}개, 실패 ${errors.length}개`);

    // 결과 반환
    if (recalledCount === 0 && errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: '일괄 회수에 실패했습니다.',
          errors: errors.slice(0, 10)
        },
        { status: 400 }
      );
    }

    const response: {
      success: boolean;
      message: string;
      recalledCount: number;
      totalCount: number;
      errorCount: number;
      errors?: string[];
      hasErrors?: boolean;
    } = {
      success: true,
      message: `${recalledCount}개의 교환권이 성공적으로 일괄 회수되었습니다.`,
      recalledCount,
      totalCount: recalledCount + errors.length,
      errorCount: errors.length
    };

    if (errors.length > 0) {
      response.message += ` (${errors.length}개 실패)`;
      response.errors = errors.slice(0, 10);
      response.hasErrors = true;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('일괄 회수 API 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '서버 오류가 발생했습니다.'
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