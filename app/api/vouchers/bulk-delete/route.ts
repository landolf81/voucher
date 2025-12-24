import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 대량 삭제 요청 스키마
const bulkDeleteSchema = z.object({
  voucher_ids: z.array(z.string().uuid()).min(1).max(1000).optional(),
  template_id: z.string().uuid().optional()
}).refine(
  (data) => !!(data.voucher_ids || data.template_id),
  {
    message: '교환권 ID 배열 또는 템플릿 ID 중 하나는 필수입니다.',
    path: ['voucher_ids']
  }
).refine(
  (data) => !(data.voucher_ids && data.template_id),
  {
    message: '교환권 ID 배열과 템플릿 ID를 동시에 제공할 수 없습니다.',
    path: ['template_id']
  }
);

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

    const { voucher_ids, template_id } = validation.data;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 삭제할 교환권들의 상태 확인
    let vouchersQuery = supabase
      .from('vouchers')
      .select('id, serial_no, status');

    if (voucher_ids) {
      vouchersQuery = vouchersQuery.in('id', voucher_ids);
    } else if (template_id) {
      vouchersQuery = vouchersQuery.eq('template_id', template_id);
    }

    const { data: vouchers, error: selectError } = await vouchersQuery;

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
    const batchSize = 500; // 배치 크기 제한 (안정성을 위해 500개로 제한)
    let deletedCount = 0;
    let hasError = false;
    let errorMessage = '';

    // 템플릿별 삭제인 경우 SQL로 직접 삭제 (더 효율적)
    if (template_id) {
      const { data, error: deleteError } = await supabase
        .rpc('delete_vouchers_by_template', {
          p_template_id: template_id,
          p_exclude_statuses: ['used', 'disposed']
        });

      if (deleteError) {
        console.error('템플릿별 삭제 RPC 오류:', deleteError);
        // RPC가 실패하면 배치 삭제로 폴백
        console.log('RPC 실패, 배치 삭제로 진행합니다...');
      } else {
        deletedCount = data || 0;
        console.log(`RPC로 ${deletedCount}개 교환권 템플릿별 삭제 완료`);
      }
    }

    // RPC가 실패했거나 개별 ID 삭제인 경우 배치 삭제 수행
    if (deletedCount === 0) {
      for (let i = 0; i < deletableIds.length; i += batchSize) {
        const batchIds = deletableIds.slice(i, i + batchSize);
        
        console.log(`배치 삭제 ${Math.floor(i / batchSize) + 1}/${Math.ceil(deletableIds.length / batchSize)}: ${batchIds.length}개`);
        
        const { error: deleteError, count } = await supabase
          .from('vouchers')
          .delete()
          .in('id', batchIds);

        if (deleteError) {
          console.error(`배치 ${Math.floor(i / batchSize) + 1} 삭제 오류:`, deleteError);
          hasError = true;
          errorMessage = deleteError.message || '교환권 삭제 중 오류가 발생했습니다.';
          break;
        }

        deletedCount += count || batchIds.length;
      }
    }

    if (hasError) {
      return NextResponse.json(
        {
          success: false,
          message: `${deletedCount}개 삭제 후 오류 발생: ${errorMessage}`
        },
        { status: 500 }
      );
    }

    const deleteType = template_id ? '템플릿별 전체' : '선택된';
    console.log(`${deletedCount}개 교환권 ${deleteType} 삭제 완료`);

    return NextResponse.json({
      success: true,
      message: `${deletedCount}개의 교환권이 성공적으로 삭제되었습니다.`,
      data: {
        deletedCount: deletedCount,
        totalRequested: deletableIds.length,
        deleteType: deleteType,
        batchCount: Math.ceil(deletableIds.length / batchSize)
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