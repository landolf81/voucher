import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 대량 삭제 요청 스키마
const bulkDeleteSchema = z.object({
  voucher_ids: z.array(z.string().uuid()).min(1).max(1000)
});

// POST: 교환권 대량 삭제
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('교환권 대량 삭제 API 호출:', body);

    // 입력 검증
    const validation = bulkDeleteSchema.safeParse(body);
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

    const { voucher_ids } = validation.data;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 삭제할 교환권들의 상태 확인
    const { data: vouchers, error: selectError } = await supabase
      .from('vouchers')
      .select('id, serial_no, status')
      .in('id', voucher_ids);

    if (selectError) {
      console.error('교환권 조회 오류:', selectError);
      return NextResponse.json(
        {
          success: false,
          message: '교환권 조회 중 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }

    if (!vouchers || vouchers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '삭제할 교환권을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    // 사용되거나 폐기된 교환권 확인
    const nonDeletableVouchers = vouchers.filter(v => ['used', 'disposed'].includes(v.status));
    if (nonDeletableVouchers.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `사용되거나 폐기된 교환권은 삭제할 수 없습니다. (${nonDeletableVouchers.length}개)`
        },
        { status: 400 }
      );
    }

    // 삭제 가능한 교환권들만 삭제
    const deletableIds = vouchers.map(v => v.id);
    
    const { error: deleteError } = await supabase
      .from('vouchers')
      .delete()
      .in('id', deletableIds);

    if (deleteError) {
      console.error('Supabase 대량 삭제 오류:', deleteError);
      return NextResponse.json(
        {
          success: false,
          message: '교환권 삭제 중 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }

    console.log(`${deletableIds.length}개 교환권 대량 삭제 완료`);

    return NextResponse.json({
      success: true,
      message: `${deletableIds.length}개의 교환권이 성공적으로 삭제되었습니다.`,
      data: {
        deletedCount: deletableIds.length,
        deletedIds: deletableIds
      }
    });

  } catch (error) {
    console.error('교환권 대량 삭제 API 오류:', error);
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