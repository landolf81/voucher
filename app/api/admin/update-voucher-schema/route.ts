import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// 교환권 테이블 스키마 업데이트 API (단계별 실행)
export async function POST(request: NextRequest) {
  try {
    const { step } = await request.json();
    console.log(`교환권 스키마 업데이트 - 단계 ${step}`);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let result;

    switch (step) {
      case 1:
        // phone 컬럼 추가
        try {
          // 실제로는 Supabase SQL 에디터에서 실행해야 함
          // 여기서는 정보만 제공
          result = {
            sql: 'ALTER TABLE vouchers ADD COLUMN phone text;',
            description: 'phone 컬럼 추가 (필수 아님)',
            note: 'Supabase 대시보드의 SQL 에디터에서 실행해주세요.'
          };
        } catch (error) {
          console.error('Step 1 오류:', error);
          result = { error: 'phone 컬럼 추가 실패' };
        }
        break;

      case 2:
        // 상태 제약조건 변경
        result = {
          sql: `
-- 기존 제약조건 제거
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_status_check;

-- 새로운 상태 제약조건 추가
ALTER TABLE vouchers ADD CONSTRAINT vouchers_status_check 
  CHECK (status IN ('registered', 'issued', 'used', 'recalled', 'disposed'));`,
          description: '상태 체계 변경: registered -> issued -> used/recalled/disposed',
          note: 'Supabase 대시보드의 SQL 에디터에서 실행해주세요.'
        };
        break;

      case 3:
        // 회수/폐기 관련 컬럼 추가
        result = {
          sql: `
-- 회수 관련 컬럼
ALTER TABLE vouchers ADD COLUMN recalled_at timestamptz;
ALTER TABLE vouchers ADD COLUMN recalled_by_user_id uuid REFERENCES users(id);
ALTER TABLE vouchers ADD COLUMN recall_reason text;

-- 폐기 관련 컬럼
ALTER TABLE vouchers ADD COLUMN disposed_at timestamptz;
ALTER TABLE vouchers ADD COLUMN disposed_by_user_id uuid REFERENCES users(id);
ALTER TABLE vouchers ADD COLUMN disposal_reason text;`,
          description: '회수 및 폐기 관련 컬럼 추가',
          note: 'Supabase 대시보드의 SQL 에디터에서 실행해주세요.'
        };
        break;

      case 4:
        // 인덱스 추가
        result = {
          sql: `
-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_vouchers_phone ON vouchers(phone);
CREATE INDEX IF NOT EXISTS idx_vouchers_recalled_at ON vouchers(recalled_at);
CREATE INDEX IF NOT EXISTS idx_vouchers_disposed_at ON vouchers(disposed_at);`,
          description: '성능 향상을 위한 인덱스 추가',
          note: 'Supabase 대시보드의 SQL 에디터에서 실행해주세요.'
        };
        break;

      case 'verify':
        // 업데이트 결과 확인
        const { data: sampleData, error: sampleError } = await supabase
          .from('vouchers')
          .select('id, serial_no, status, phone, recalled_at, disposed_at')
          .limit(1)
          .maybeSingle();

        result = {
          description: '스키마 업데이트 확인',
          sampleData,
          hasPhoneColumn: !sampleError,
          error: sampleError?.message
        };
        break;

      default:
        // 전체 SQL 제공
        result = {
          allStepsSQL: `
-- 1단계: phone 컬럼 추가
ALTER TABLE vouchers ADD COLUMN phone text;

-- 2단계: 상태 제약조건 변경
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_status_check;
ALTER TABLE vouchers ADD CONSTRAINT vouchers_status_check 
  CHECK (status IN ('registered', 'issued', 'used', 'recalled', 'disposed'));

-- 3단계: 회수/폐기 컬럼 추가
ALTER TABLE vouchers ADD COLUMN recalled_at timestamptz;
ALTER TABLE vouchers ADD COLUMN recalled_by_user_id uuid REFERENCES users(id);
ALTER TABLE vouchers ADD COLUMN recall_reason text;
ALTER TABLE vouchers ADD COLUMN disposed_at timestamptz;
ALTER TABLE vouchers ADD COLUMN disposed_by_user_id uuid REFERENCES users(id);
ALTER TABLE vouchers ADD COLUMN disposal_reason text;

-- 4단계: 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_vouchers_phone ON vouchers(phone);
CREATE INDEX IF NOT EXISTS idx_vouchers_recalled_at ON vouchers(recalled_at);
CREATE INDEX IF NOT EXISTS idx_vouchers_disposed_at ON vouchers(disposed_at);`,
          description: '전체 마이그레이션 SQL',
          instruction: `
1. Supabase 대시보드 → SQL 에디터로 이동
2. 위의 SQL을 붙여넣기하여 실행
3. /api/admin/update-voucher-schema (POST, step: "verify")로 확인`
        };
        break;
    }

    return NextResponse.json({
      success: true,
      step,
      result
    });

  } catch (error) {
    console.error('스키마 업데이트 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '스키마 업데이트 중 오류가 발생했습니다.',
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