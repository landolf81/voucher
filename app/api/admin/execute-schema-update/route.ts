import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// 실제 스키마 업데이트 실행 API (개발 환경에서만)
export async function POST(request: NextRequest) {
  try {
    // 개발 환경에서만 실행
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        {
          success: false,
          message: '이 API는 개발 환경에서만 사용할 수 있습니다.'
        },
        { status: 403 }
      );
    }

    console.log('교환권 스키마 실제 업데이트 시작');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const results = [];

    // 1. phone 컬럼 추가 시도
    try {
      // 테스트: 이미 phone 컬럼이 있는지 확인
      const { data: testPhone, error: testPhoneError } = await supabase
        .from('vouchers')
        .select('phone')
        .limit(1);

      if (testPhoneError && testPhoneError.message.includes('does not exist')) {
        // phone 컬럼이 없음 - SQL로 직접 추가는 어려우므로 Supabase API 방식 사용
        results.push({
          step: 'phone_column',
          success: false,
          message: 'phone 컬럼이 없음. Supabase 대시보드에서 수동으로 추가해야 함.',
          sql: 'ALTER TABLE vouchers ADD COLUMN phone text;'
        });
      } else {
        results.push({
          step: 'phone_column',
          success: true,
          message: 'phone 컬럼이 이미 존재합니다.'
        });
      }
    } catch (error) {
      results.push({
        step: 'phone_column',
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }

    // 2. 회수/폐기 컬럼 추가 (Supabase는 ALTER TABLE을 직접 지원하지 않으므로 수동 안내)
    results.push({
      step: 'additional_columns',
      success: false,
      message: 'Supabase 대시보드에서 다음 컬럼들을 수동으로 추가해야 합니다.',
      columns: [
        { name: 'recalled_at', type: 'timestamptz', nullable: true },
        { name: 'recalled_by_user_id', type: 'uuid', nullable: true, references: 'users(id)' },
        { name: 'recall_reason', type: 'text', nullable: true },
        { name: 'disposed_at', type: 'timestamptz', nullable: true },
        { name: 'disposed_by_user_id', type: 'uuid', nullable: true, references: 'users(id)' },
        { name: 'disposal_reason', type: 'text', nullable: true }
      ]
    });

    // 3. 현재 테이블 상태 확인
    const { data: currentData, error: currentError } = await supabase
      .from('vouchers')
      .select('*')
      .limit(1)
      .maybeSingle();

    results.push({
      step: 'current_status',
      success: !currentError,
      currentColumns: currentData ? Object.keys(currentData) : [],
      sample: currentData,
      error: currentError?.message
    });

    console.log('교환권 스키마 업데이트 결과:', results);

    return NextResponse.json({
      success: true,
      message: '스키마 업데이트 실행 결과',
      results,
      instructions: {
        manual_steps: [
          '1. Supabase 대시보드 → Table Editor → vouchers 테이블로 이동',
          '2. "Add Column" 버튼 클릭하여 다음 컬럼들 추가:',
          '   - phone (text, nullable)',
          '   - recalled_at (timestamptz, nullable)',
          '   - recalled_by_user_id (uuid, nullable, Foreign Key: users.id)',
          '   - recall_reason (text, nullable)',
          '   - disposed_at (timestamptz, nullable)',
          '   - disposed_by_user_id (uuid, nullable, Foreign Key: users.id)',
          '   - disposal_reason (text, nullable)',
          '3. SQL Editor에서 상태 제약조건 업데이트:',
          '   ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_status_check;',
          '   ALTER TABLE vouchers ADD CONSTRAINT vouchers_status_check CHECK (status IN (\'registered\', \'issued\', \'used\', \'recalled\', \'disposed\'));',
          '4. API 테스트: POST /api/admin/update-voucher-schema {"step": "verify"}'
        ]
      }
    });

  } catch (error) {
    console.error('스키마 업데이트 실행 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '스키마 업데이트 실행 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : '알 수 없는 오류'
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