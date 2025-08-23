import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 일괄 교환권 회수 스키마
const bulkCollectVoucherSchema = z.object({
  serial_numbers: z.array(z.string().min(1)).optional(),
  voucher_ids: z.array(z.string().min(1)).optional(),
  reason: z.string().optional(),
  notes: z.string().optional()
}).refine(data => data.serial_numbers || data.voucher_ids, {
  message: '일련번호 또는 교환권 ID가 필요합니다.'
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('일괄 교환권 회수 API 호출:', body);

    // 입력 검증
    const validation = bulkCollectVoucherSchema.safeParse(body);
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

    const { serial_numbers, voucher_ids, reason, notes } = validation.data;

    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // 서비스 역할 키 사용
    );

    // 현재 사용자 정보 가져오기 (실제 구현에서는 JWT 토큰에서 추출)
    // TODO: 실제 구현에서는 인증된 사용자 ID를 가져와야 함
    const currentUserId = null; // UUID 형식이 아니므로 null로 설정
    const currentUserRole = 'admin'; // TODO: 실제 사용자 역할 가져오기

    // 관리자 권한 확인
    if (currentUserRole !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          message: '일괄 교환권 회수는 관리자만 수행할 수 있습니다.'
        },
        { status: 403 }
      );
    }

    // 결과 추적용 배열
    const results = [];
    const successCount = { count: 0 };
    const errorCount = { count: 0 };

    // voucher_ids가 있으면 ID로 처리, 없으면 serial_numbers로 처리
    if (voucher_ids && voucher_ids.length > 0) {
      // ID로 일괄 처리
      for (const voucher_id of voucher_ids) {
        try {
          // 교환권 조회
          const { data: voucher, error: findError } = await supabase
            .from('vouchers')
            .select('*')
            .eq('id', voucher_id)
            .single();

          if (findError || !voucher) {
            results.push({
              serial_no: voucher_id,
              success: false,
              message: '해당 교환권을 찾을 수 없습니다.'
            });
            errorCount.count++;
            continue;
          }

          // 교환권 상태 확인 - 발행된 상태에서만 회수 가능
          if (voucher.status !== 'issued') {
            let statusMessage = '';
            switch (voucher.status) {
              case 'used':
                statusMessage = '이미 사용된 교환권입니다.';
                break;
              case 'recalled':
                statusMessage = '이미 회수된 교환권입니다.';
                break;
              case 'disposed':
                statusMessage = '이미 폐기된 교환권입니다.';
                break;
              case 'registered':
                statusMessage = '아직 발행되지 않은 교환권입니다.';
                break;
              default:
                statusMessage = '회수할 수 없는 상태입니다.';
            }
            
            results.push({
              serial_no: voucher.serial_no,
              success: false,
              message: statusMessage,
              current_status: voucher.status
            });
            errorCount.count++;
            continue;
          }

          // 교환권 상태를 'recalled'로 업데이트 (notes에 회수 사유 저장)
          const recallReason = reason || notes || '사용기간 만료';
          const { error: updateError } = await supabase
            .from('vouchers')
            .update({
              status: 'recalled',
              used_at: new Date().toISOString(), // 회수 시간을 used_at에 저장
              notes: voucher.notes ? `${voucher.notes} | 회수: ${recallReason}` : `회수: ${recallReason}`
            })
            .eq('id', voucher.id);

          if (updateError) {
            console.error(`교환권 회수 업데이트 오류 (${voucher.serial_no}):`, updateError);
            results.push({
              serial_no: voucher.serial_no,
              success: false,
              message: '교환권 회수 업데이트에 실패했습니다.'
            });
            errorCount.count++;
            continue;
          }

          // 감사 로그 추가
          const { error: auditError } = await supabase
            .from('audit_logs')
            .insert({
              voucher_id: voucher.id,
              action: 'voucher_recalled',
              actor_user_id: currentUserId,
              details: {
                serial_no: voucher.serial_no,
                recall_reason: recallReason,
                previous_status: voucher.status,
                new_status: 'recalled',
                recalled_at: new Date().toISOString(),
                bulk_operation: true,
                notes: notes
              }
            });

          if (auditError) {
            console.error(`감사 로그 추가 오류 (${voucher.serial_no}):`, auditError);
            // 감사 로그 실패는 전체 작업을 중단시키지 않음
          }

          results.push({
            serial_no: voucher.serial_no,
            success: true,
            message: '교환권이 성공적으로 회수되었습니다.',
            collected_at: new Date().toISOString(),
            previous_status: voucher.status
          });
          successCount.count++;

        } catch (error) {
          console.error(`교환권 회수 중 오류 (${voucher_id}):`, error);
          results.push({
            serial_no: voucher_id,
            success: false,
            message: '처리 중 오류가 발생했습니다.'
          });
          errorCount.count++;
        }
      }
    } else if (serial_numbers && serial_numbers.length > 0) {
      // 기존 일련번호 처리 로직
      for (const serial_no of serial_numbers) {
        try {
          // 교환권 조회
          const { data: voucher, error: findError } = await supabase
            .from('vouchers')
            .select('*')
            .eq('serial_no', serial_no)
            .single();

          if (findError || !voucher) {
            results.push({
              serial_no,
              success: false,
              message: '해당 일련번호의 교환권을 찾을 수 없습니다.'
            });
            errorCount.count++;
            continue;
          }

          // 교환권 상태 확인 - 발행된 상태에서만 회수 가능
          if (voucher.status !== 'issued') {
            let statusMessage = '';
            switch (voucher.status) {
              case 'used':
                statusMessage = '이미 사용된 교환권입니다.';
                break;
              case 'recalled':
                statusMessage = '이미 회수된 교환권입니다.';
                break;
              case 'disposed':
                statusMessage = '이미 폐기된 교환권입니다.';
                break;
              case 'registered':
                statusMessage = '아직 발행되지 않은 교환권입니다.';
                break;
              default:
                statusMessage = '회수할 수 없는 상태입니다.';
            }
            
            results.push({
              serial_no,
              success: false,
              message: statusMessage,
              current_status: voucher.status
            });
            errorCount.count++;
            continue;
          }

          // 교환권 상태를 'recalled'로 업데이트 (notes에 회수 사유 저장)
          const recallReason = reason || notes || '사용기간 만료';
          const { error: updateError } = await supabase
            .from('vouchers')
            .update({
              status: 'recalled',
              used_at: new Date().toISOString(), // 회수 시간을 used_at에 저장
              notes: voucher.notes ? `${voucher.notes} | 회수: ${recallReason}` : `회수: ${recallReason}`
            })
            .eq('id', voucher.id);

          if (updateError) {
            console.error(`교환권 회수 업데이트 오류 (${serial_no}):`, updateError);
            results.push({
              serial_no,
              success: false,
              message: '교환권 회수 업데이트에 실패했습니다.'
            });
            errorCount.count++;
            continue;
          }

          // 감사 로그 추가
          const { error: auditError } = await supabase
            .from('audit_logs')
            .insert({
              action: 'voucher_bulk_collected',
              target_type: 'voucher',
              target_id: voucher.id,
              user_id: currentUserId,
              details: {
                serial_no: serial_no,
                reason: reason,
                notes: notes,
                previous_status: voucher.status,
                new_status: 'recalled',
                collected_at: new Date().toISOString(),
                bulk_operation: true
              },
              ip_address: request.headers.get('x-forwarded-for') || 'unknown'
            });

          if (auditError) {
            console.error(`감사 로그 추가 오류 (${serial_no}):`, auditError);
            // 감사 로그 실패는 전체 작업을 중단시키지 않음
          }

          results.push({
            serial_no,
            success: true,
            message: '교환권이 성공적으로 회수되었습니다.',
            collected_at: new Date().toISOString(),
            previous_status: voucher.status
          });
          successCount.count++;

        } catch (error) {
          console.error(`교환권 회수 중 오류 (${serial_no}):`, error);
          results.push({
            serial_no,
            success: false,
            message: '처리 중 오류가 발생했습니다.'
          });
          errorCount.count++;
        }
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          message: '일련번호 또는 교환권 ID가 필요합니다.'
        },
        { status: 400 }
      );
    }

    const totalCount = voucher_ids ? voucher_ids.length : (serial_numbers ? serial_numbers.length : 0);
    
    console.log('일괄 교환권 회수 완료:', {
      total: totalCount,
      success: successCount.count,
      error: errorCount.count,
      reason,
      notes
    });

    // 전체 결과 반환
    const overallSuccess = successCount.count > 0;
    const statusCode = errorCount.count === 0 ? 200 : (successCount.count === 0 ? 400 : 207); // 207: Multi-Status

    return NextResponse.json({
      success: overallSuccess,
      message: `총 ${totalCount}개 중 ${successCount.count}개 회수 성공, ${errorCount.count}개 실패`,
      summary: {
        total: totalCount,
        success: successCount.count,
        error: errorCount.count
      },
      results: results,
      bulk_operation: {
        reason: reason,
        notes: notes,
        processed_at: new Date().toISOString()
      }
    }, { status: statusCode });

  } catch (error) {
    console.error('일괄 교환권 회수 오류:', error);
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