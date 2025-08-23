import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 일괄 교환권 사용 등록 스키마
const bulkRegisterUseSchema = z.object({
  vouchers: z.array(z.object({
    serial_no: z.string().min(1, '일련번호를 입력해주세요.'),
    usage_location: z.string().optional(), // 사용처명 (display용)
    usage_amount: z.number().optional(),
    notes: z.string().optional(),
    customer_info: z.object({
      name: z.string().optional(),
      phone: z.string().optional()
    }).optional()
  })).min(1, '최소 1개의 교환권 정보가 필요합니다.'),
  site_id: z.string().optional(), // UUID 검증 제거 (현재는 site_name일 수 있음)
  bulk_notes: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('일괄 교환권 사용 등록 API 호출:', body);

    // 입력 검증
    const validation = bulkRegisterUseSchema.safeParse(body);
    if (!validation.success) {
      console.error('입력 검증 실패:', validation.error.errors);
      console.error('받은 데이터:', body);
      return NextResponse.json(
        {
          success: false,
          message: '입력 정보가 올바르지 않습니다.',
          errors: validation.error.errors,
          received_data: body
        },
        { status: 400 }
      );
    }

    const { vouchers, site_id, bulk_notes } = validation.data;

    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // 서비스 역할 키 사용
    );

    // 현재는 간단하게 처리 - 실제 운영환경에서는 인증 개선 필요
    let currentUserId = '00000000-0000-0000-0000-000000000000'; // 기본 시스템 사용자 (UUID 형태)
    let currentSiteId = null;
    
    // site_id 처리
    if (site_id) {
      if (site_id.includes('-') && site_id.length > 20) {
        // UUID 형태인 경우
        currentSiteId = site_id;
      } else {
        // site_name인 경우 사이트 ID 조회
        const { data: site } = await supabase
          .from('sites')
          .select('id')
          .eq('site_name', site_id)
          .maybeSingle();
        currentSiteId = site?.id;
        
        if (!currentSiteId) {
          console.warn('사이트를 찾을 수 없음:', site_id);
        }
      }
    }

    // 결과 추적용 배열
    const results = [];
    const successCount = { count: 0 };
    const errorCount = { count: 0 };

    // 각 교환권에 대해 사용 등록 처리
    for (const voucherData of vouchers) {
      const { serial_no, usage_location, usage_amount, notes, customer_info } = voucherData;
      
      try {
        // 개별 교환권의 사용처 결정
        let voucherSiteId = currentSiteId; // 기본값: 전체 요청의 site_id
        
        if (usage_location) {
          // usage_location이 제공된 경우 해당 사이트 ID 조회
          const { data: site } = await supabase
            .from('sites')
            .select('id')
            .eq('site_name', usage_location)
            .maybeSingle();
          
          if (site?.id) {
            voucherSiteId = site.id;
            console.log(`교환권 ${serial_no}의 사용처: ${usage_location} -> ${site.id}`);
          } else {
            console.warn(`사용처를 찾을 수 없음: ${usage_location}, 기본 사이트 사용: ${currentSiteId}`);
          }
        }

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

        // 교환권 상태 확인 - 발행된 상태에서만 사용 가능
        if (voucher.status !== 'issued') {
          let statusMessage = '';
          switch (voucher.status) {
            case 'used':
              statusMessage = '이미 사용된 교환권입니다.';
              break;
            case 'recalled':
              statusMessage = '회수된 교환권은 사용할 수 없습니다.';
              break;
            case 'disposed':
              statusMessage = '폐기된 교환권은 사용할 수 없습니다.';
              break;
            case 'registered':
              statusMessage = '아직 발행되지 않은 교환권입니다.';
              break;
            default:
              statusMessage = '사용할 수 없는 상태입니다.';
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

        // 사용 금액 검증 (부분 사용 지원)
        const actualUsageAmount = usage_amount || voucher.amount;
        if (usage_amount && usage_amount > voucher.amount) {
          results.push({
            serial_no,
            success: false,
            message: `사용 금액(${usage_amount})이 교환권 금액(${voucher.amount})을 초과할 수 없습니다.`
          });
          errorCount.count++;
          continue;
        }

        // 교환권 상태를 'used'로 업데이트
        const updateData: any = {
          status: 'used',
          used_at: new Date().toISOString(),
          used_by_user_id: null, // 현재는 NULL로 처리 (실제 사용자 인증 구현 시 수정)
          used_at_site_id: voucherSiteId, // 개별 교환권의 사용처 사용
          notes: [notes, bulk_notes].filter(Boolean).join(' | ') || null
        };

        // 데이터베이스 스키마에 존재하는 필드만 포함
        // usage_location, usage_amount, remaining_amount, customer_name, customer_phone 필드는 
        // 현재 스키마에 없으므로 제외

        const { error: updateError } = await supabase
          .from('vouchers')
          .update(updateData)
          .eq('id', voucher.id);

        if (updateError) {
          console.error(`교환권 사용 업데이트 오류 (${serial_no}):`, updateError);
          results.push({
            serial_no,
            success: false,
            message: '교환권 사용 등록 업데이트에 실패했습니다.'
          });
          errorCount.count++;
          continue;
        }

        // 감사 로그 추가
        const { error: auditError } = await supabase
          .from('audit_logs')
          .insert({
            voucher_id: voucher.id,
            action: 'voucher_bulk_usage_registered',
            actor_user_id: null, // 현재는 NULL로 처리 (실제 사용자 인증 구현 시 수정)
            site_id: voucherSiteId, // 개별 교환권의 사용처 사용
            details: {
              serial_no: serial_no,
              usage_location: usage_location,
              resolved_site_id: voucherSiteId,
              usage_amount: actualUsageAmount,
              voucher_amount: voucher.amount,
              customer_info: customer_info,
              individual_notes: notes,
              bulk_notes: bulk_notes,
              previous_status: voucher.status,
              new_status: 'used',
              registered_at: new Date().toISOString(),
              bulk_operation: true
            }
          });

        if (auditError) {
          console.error(`감사 로그 추가 오류 (${serial_no}):`, auditError);
          // 감사 로그 실패는 전체 작업을 중단시키지 않음
        }

        results.push({
          serial_no,
          success: true,
          message: '교환권 사용이 성공적으로 등록되었습니다.',
          usage_location: usage_location,
          resolved_site_id: voucherSiteId,
          usage_amount: actualUsageAmount,
          voucher_amount: voucher.amount,
          used_at: new Date().toISOString(),
          previous_status: voucher.status
        });
        successCount.count++;

      } catch (error) {
        console.error(`교환권 사용 등록 중 오류 (${serial_no}):`, error);
        results.push({
          serial_no,
          success: false,
          message: '처리 중 오류가 발생했습니다.'
        });
        errorCount.count++;
      }
    }

    console.log('일괄 교환권 사용 등록 완료:', {
      total: vouchers.length,
      success: successCount.count,
      error: errorCount.count,
      site_id: currentSiteId,
      user_id: currentUserId
    });

    // 전체 결과 반환
    const overallSuccess = successCount.count > 0;
    const statusCode = errorCount.count === 0 ? 200 : (successCount.count === 0 ? 400 : 207); // 207: Multi-Status

    return NextResponse.json({
      success: overallSuccess,
      message: `총 ${vouchers.length}개 중 ${successCount.count}개 사용 등록 성공, ${errorCount.count}개 실패`,
      summary: {
        total: vouchers.length,
        success: successCount.count,
        error: errorCount.count
      },
      results: results,
      bulk_operation: {
        site_id: currentSiteId,
        user_id: currentUserId,
        bulk_notes: bulk_notes,
        processed_at: new Date().toISOString()
      }
    }, { status: statusCode });

  } catch (error) {
    console.error('일괄 교환권 사용 등록 오류:', error);
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