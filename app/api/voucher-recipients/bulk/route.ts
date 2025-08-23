import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { encryptVoucherData } from '@/lib/encryption';
import { z } from 'zod';

// 일괄 발행대상자 등록 스키마 (개별 금액 포함)
const bulkRecipientsSchema = z.object({
  template_id: z.string().min(1, '교환권 템플릿 ID를 선택해주세요.'),
  recipients: z.array(z.object({
    member_id: z.string().min(1).max(50),
    farming_association: z.string().min(1).max(100),
    name: z.string().min(1).max(50),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    phone: z.string().min(10).max(15),
    amount: z.number().positive().int(),
    notes: z.string().optional().default(''),
    row: z.number().optional()
  })).min(1).max(1000)
});

// POST: 발행대상자 일괄 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('발행대상자 일괄 등록 API 호출, 데이터 수:', body.recipients?.length || 0);

    // 입력 검증
    const validation = bulkRecipientsSchema.safeParse(body);
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

    const { template_id, recipients } = validation.data;

    // 발행대상자 데이터 준비 (암호화 포함)
    const recipientsToInsert = recipients.map(recipient => {
      const { encrypted_name, encrypted_dob, encrypted_phone } = encryptVoucherData({
        name: recipient.name,
        dob: recipient.dob,
        phone: recipient.phone
      });

      return {
        template_id,
        member_id: recipient.member_id,
        farming_association: recipient.farming_association,
        encrypted_name,
        encrypted_dob,
        encrypted_phone,
        amount: recipient.amount,
        status: 'registered' as const,
        notes: recipient.notes || ''
      };
    });

    // 데이터베이스에 일괄 저장
    let insertedCount = 0;
    const errors: string[] = [];

    // Supabase 사용 - 배치 삽입
    console.log('Supabase 사용 - 발행대상자 일괄 등록');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 배치 크기로 나누어 처리
    const batchSize = 100;
    for (let i = 0; i < recipientsToInsert.length; i += batchSize) {
      const batch = recipientsToInsert.slice(i, i + batchSize);
      
      try {
        const { data, error } = await supabase
          .from('voucher_recipients')
          .insert(batch.map(recipient => ({
            ...recipient,
            created_at: new Date().toISOString()
          })));

        if (error) {
          console.error('Supabase 배치 삽입 오류:', error);
          // 개별 삽입으로 재시도
          for (const [batchIndex, recipientData] of batch.entries()) {
            try {
              const { error: individualError } = await supabase
                .from('voucher_recipients')
                .insert([{
                  ...recipientData,
                  created_at: new Date().toISOString()
                }]);
              
              if (individualError) {
                const originalIndex = i + batchIndex;
                const rowNum = recipients[originalIndex].row || originalIndex + 1;
                errors.push(`${rowNum}행: ${individualError.message}`);
              } else {
                insertedCount++;
              }
            } catch (individualError) {
              const originalIndex = i + batchIndex;
              const rowNum = recipients[originalIndex].row || originalIndex + 1;
              errors.push(`${rowNum}행: 저장 실패`);
            }
          }
        } else {
          insertedCount += batch.length;
        }
      } catch (error) {
        console.error('배치 처리 오류:', error);
        for (let j = 0; j < batch.length; j++) {
          const originalIndex = i + j;
          const rowNum = recipients[originalIndex].row || originalIndex + 1;
          errors.push(`${rowNum}행: 배치 처리 실패`);
        }
      }
    }

    console.log(`발행대상자 일괄 등록 완료: 성공 ${insertedCount}개, 실패 ${errors.length}개`);

    // 결과 반환
    if (insertedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '발행대상자 등록에 실패했습니다.',
          errors: errors.slice(0, 10)
        },
        { status: 400 }
      );
    }

    const response: {
      success: boolean;
      message: string;
      insertedCount: number;
      totalCount: number;
      errorCount: number;
      errors?: string[];
      hasErrors?: boolean;
    } = {
      success: true,
      message: `${insertedCount}개의 발행대상자가 성공적으로 등록되었습니다.`,
      insertedCount,
      totalCount: recipients.length,
      errorCount: errors.length
    };

    if (errors.length > 0) {
      response.message += ` (${errors.length}개 실패)`;
      response.errors = errors.slice(0, 10); // 처음 10개 오류만 반환
      response.hasErrors = true;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('발행대상자 일괄 등록 오류:', error);
    
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