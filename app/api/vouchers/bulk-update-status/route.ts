import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { voucher_ids, status } = body;

    if (!voucher_ids || !Array.isArray(voucher_ids) || voucher_ids.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '업데이트할 교환권을 선택해주세요.'
        },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        {
          success: false,
          message: '상태값이 필요합니다.'
        },
        { status: 400 }
      );
    }

    // 유효한 상태값 확인
    const validStatuses = ['registered', 'issued', 'used', 'recalled', 'disposed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          message: '유효하지 않은 상태값입니다.'
        },
        { status: 400 }
      );
    }

    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 배치로 업데이트 처리 (1000개씩)
    const BATCH_SIZE = 1000;
    const totalBatches = Math.ceil(voucher_ids.length / BATCH_SIZE);
    let totalUpdated = 0;
    const errors = [];

    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, voucher_ids.length);
      const batchIds = voucher_ids.slice(start, end);

      const { data, error } = await supabase
        .from('vouchers')
        .update({ 
          status: status,
          ...(status === 'issued' ? { issued_at: new Date().toISOString() } : {})
        })
        .in('id', batchIds)
        .select();

      if (error) {
        console.error(`배치 ${i + 1} 업데이트 오류:`, error);
        errors.push(`배치 ${i + 1}: ${error.message}`);
      } else if (data) {
        totalUpdated += data.length;
        
        // 감사 로그 추가 (비동기로 처리)
        (async () => {
          try {
            await supabase
              .from('audit_logs')
              .insert(
                batchIds.map(id => ({
                  voucher_id: id,
                  action: `bulk_status_update_to_${status}`,
                  details: {
                    new_status: status,
                    batch_index: i + 1,
                    total_batches: totalBatches
                  }
                }))
              );
            console.log(`배치 ${i + 1} 감사 로그 추가 완료`);
          } catch (error: any) {
            console.error(`배치 ${i + 1} 감사 로그 추가 오류:`, error);
          }
        })();
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        message: `일부 교환권 업데이트 실패 (${totalUpdated}/${voucher_ids.length}개 성공)`,
        errors: errors,
        updated_count: totalUpdated
      }, { status: 207 }); // 207: Multi-Status
    }

    return NextResponse.json({
      success: true,
      message: `${totalUpdated}개의 교환권 상태가 '${status}'로 업데이트되었습니다.`,
      updated_count: totalUpdated
    });

  } catch (error) {
    console.error('교환권 상태 일괄 업데이트 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}