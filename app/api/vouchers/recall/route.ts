import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 교환권 회수 스키마
const recallVouchersSchema = z.object({
  voucher_ids: z.array(z.string()).min(1, '회수할 교환권을 선택해주세요.').max(1000, '한 번에 최대 1000개의 교환권만 회수할 수 있습니다.'),
  reason: z.string().optional().default(''), // 회수 사유
  retrieved_by: z.string().optional(), // 회수자 ID
  retrieved_at: z.string().optional(), // 회수 일시
  site_id: z.string().optional(), // 사업장 ID
  method: z.enum(['manual', 'barcode', 'qrcode']).optional().default('manual') // 회수 방식
});

// POST: 교환권 회수 (일괄 처리)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('교환권 회수 API 호출, 대상 수:', body.voucher_ids?.length || 0);

    // 입력 검증
    const validation = recallVouchersSchema.safeParse(body);
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

    const { voucher_ids, reason, retrieved_by, retrieved_at, site_id, method } = validation.data;

    let recalledCount = 0;
    const errors: string[] = [];
    const now = new Date().toISOString();

    // Supabase 사용
    console.log('Supabase 사용 - 교환권 회수');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 개별 교환권 상태 확인 후 회수 처리
    try {
      for (const [index, voucherId] of voucher_ids.entries()) {
        // 먼저 교환권 상태 확인
        const { data: voucher, error: selectError } = await supabase
          .from('vouchers')
          .select('id, status, serial_no')
          .eq('id', voucherId)
          .single();

        if (selectError || !voucher) {
          errors.push(`${index + 1}번째 교환권: 교환권을 찾을 수 없습니다.`);
          continue;
        }

        // 중복 사용 체크
        if (voucher.status === 'recalled') {
          errors.push(`${index + 1}번째 교환권: 이미 회수된 교환권입니다.`);
          continue;
        }

        if (voucher.status === 'used') {
          errors.push(`${index + 1}번째 교환권: 이미 사용된 교환권입니다.`);
          continue;
        }

        // 교환권 회수 처리
        const { error: updateError } = await supabase
          .from('vouchers')
          .update({
            status: 'recalled',
            recalled_at: retrieved_at || now,
            notes: reason ? `회수 사유: ${reason}, 방식: ${method}, 회수자: ${retrieved_by}` : `방식: ${method}, 회수자: ${retrieved_by}`
          })
          .eq('id', voucherId);

        if (updateError) {
          errors.push(`${index + 1}번째 교환권: 회수 실패`);
          console.error(`교환권 회수 실패 (${voucherId}):`, updateError);
        } else {
          recalledCount++;
        }
      }
    } catch (error) {
      console.error('교환권 회수 처리 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '서버 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }

    console.log(`교환권 회수 완료: 성공 ${recalledCount}개, 실패 ${errors.length}개`);

    // 결과 반환
    if (recalledCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '교환권 회수에 실패했습니다.',
          errors: errors.slice(0, 10)
        },
        { status: 400 }
      );
    }

    const response: any = {
      success: true,
      message: `${recalledCount}개의 교환권이 성공적으로 회수되었습니다.`,
      recalledCount,
      totalCount: voucher_ids.length,
      errorCount: errors.length
    };

    if (errors.length > 0) {
      response.message += ` (${errors.length}개 실패)`;
      response.errors = errors.slice(0, 10);
      response.hasErrors = true;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('교환권 회수 API 오류:', error);
    
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