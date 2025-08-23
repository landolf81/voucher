import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';
import { nanoid } from 'nanoid';

// 일괄 교환권 발행 스키마
const batchIssueSchema = z.object({
  template_id: z.string().min(1, '교환권 템플릿 ID를 선택해주세요.'),
  recipient_ids: z.array(z.string()).min(1, '발행 대상자를 선택해주세요.').max(1000, '한 번에 최대 1000개의 교환권만 발행할 수 있습니다.')
});

// 일련번호 생성 함수
function generateSerialNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomId = nanoid(6).toUpperCase();
  return `VCH${timestamp}${randomId}`;
}

// 중복 없는 일련번호 생성
async function generateUniqueSerialNumbers(count: number, checkExisting: (serial: string) => Promise<boolean>): Promise<string[]> {
  const serials: string[] = [];
  const maxAttempts = count * 10; // 충분한 시도 횟수
  let attempts = 0;

  while (serials.length < count && attempts < maxAttempts) {
    const serial = generateSerialNumber();
    
    // 이미 생성된 목록에 중복이 없고, DB에도 존재하지 않으면 추가
    if (!serials.includes(serial) && !(await checkExisting(serial))) {
      serials.push(serial);
    }
    
    attempts++;
  }

  if (serials.length < count) {
    throw new Error('고유한 일련번호 생성에 실패했습니다. 다시 시도해주세요.');
  }

  return serials;
}

// POST: 일괄 교환권 발행
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('일괄 교환권 발행 API 호출, 대상자 수:', body.recipient_ids?.length || 0);

    // 입력 검증
    const validation = batchIssueSchema.safeParse(body);
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

    const { template_id, recipient_ids } = validation.data;

    // Supabase 사용
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const checkExisting = async (serial: string) => {
      const { data } = await supabase
        .from('vouchers')
        .select('id')
        .eq('serial_no', serial)
        .single();
      return data !== null;
    };

    // 고유 일련번호 생성
    console.log(`${recipient_ids.length}개의 고유 일련번호 생성 중...`);
    const serialNumbers = await generateUniqueSerialNumbers(recipient_ids.length, checkExisting);

    // 교환권 발행 데이터 준비
    const vouchersToInsert = recipient_ids.map((recipient_id, index) => ({
      template_id,
      recipient_id,
      serial_no: serialNumbers[index],
      status: 'issued' as const
    }));

    // 데이터베이스에 일괄 저장
    let issuedCount = 0;
    const errors: string[] = [];

    // Supabase 사용 - 배치 삽입
    console.log('Supabase 사용 - 교환권 일괄 발행');

    // 배치 크기로 나누어 처리
    const batchSize = 100;
    for (let i = 0; i < vouchersToInsert.length; i += batchSize) {
      const batch = vouchersToInsert.slice(i, i + batchSize);
      
      try {
        const { data, error } = await supabase
          .from('vouchers')
          .insert(batch.map(voucher => ({
            ...voucher,
            issued_at: new Date().toISOString()
          })));

        if (error) {
          console.error('Supabase 배치 삽입 오류:', error);
          // 개별 삽입으로 재시도
          for (const [batchIndex, voucherData] of batch.entries()) {
            try {
              const { error: individualError } = await supabase
                .from('vouchers')
                .insert([{
                  ...voucherData,
                  issued_at: new Date().toISOString()
                }]);
              
              if (individualError) {
                const originalIndex = i + batchIndex;
                errors.push(`${originalIndex + 1}번째 교환권: ${individualError.message}`);
              } else {
                issuedCount++;
              }
            } catch (individualError) {
              const originalIndex = i + batchIndex;
              errors.push(`${originalIndex + 1}번째 교환권: 발행 실패`);
            }
          }
        } else {
          issuedCount += batch.length;
        }
      } catch (error) {
        console.error('배치 처리 오류:', error);
        for (let j = 0; j < batch.length; j++) {
          const originalIndex = i + j;
          errors.push(`${originalIndex + 1}번째 교환권: 배치 처리 실패`);
        }
      }
    }

    // 성공적으로 발행된 교환권에 대한 발행대상자 상태 업데이트
    if (issuedCount > 0) {
      try {
        await supabase
          .from('voucher_recipients')
          .update({ status: 'issued' })
          .in('id', recipient_ids.slice(0, issuedCount));
      } catch (updateError) {
        console.error('발행대상자 상태 업데이트 오류:', updateError);
      }
    }

    console.log(`일괄 교환권 발행 완료: 성공 ${issuedCount}개, 실패 ${errors.length}개`);

    // 결과 반환
    if (issuedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '교환권 발행에 실패했습니다.',
          errors: errors.slice(0, 10)
        },
        { status: 400 }
      );
    }

    const response: any = {
      success: true,
      message: `${issuedCount}개의 교환권이 성공적으로 발행되었습니다.`,
      issuedCount,
      totalCount: recipient_ids.length,
      errorCount: errors.length,
      serialNumbers: serialNumbers.slice(0, issuedCount) // 성공적으로 발행된 일련번호들
    };

    if (errors.length > 0) {
      response.message += ` (${errors.length}개 실패)`;
      response.errors = errors.slice(0, 10); // 처음 10개 오류만 반환
      response.hasErrors = true;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('일괄 교환권 발행 오류:', error);
    
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