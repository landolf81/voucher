import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// 관리자용 교환권 상태 마이그레이션 API
export async function POST(request: NextRequest) {
  try {
    console.log('교환권 상태 마이그레이션 시작');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. phone 컬럼 추가
    const { error: phoneColumnError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS phone text;'
    });

    if (phoneColumnError) {
      console.error('phone 컬럼 추가 오류:', phoneColumnError);
      // 컬럼이 이미 존재할 수 있으므로 에러를 무시하고 계속 진행
    }

    // 2. 기존 제약조건 제거
    const { error: dropConstraintError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_status_check;'
    });

    if (dropConstraintError) {
      console.error('기존 제약조건 제거 오류:', dropConstraintError);
    }

    // 3. 새로운 상태 제약조건 추가
    const { error: addConstraintError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE vouchers ADD CONSTRAINT vouchers_status_check 
            CHECK (status IN ('registered', 'issued', 'used', 'recalled', 'disposed'));`
    });

    if (addConstraintError) {
      console.error('새 제약조건 추가 오류:', addConstraintError);
      return NextResponse.json(
        {
          success: false,
          message: '상태 제약조건 추가에 실패했습니다.',
          error: addConstraintError.message
        },
        { status: 500 }
      );
    }

    // 4. 회수 관련 컬럼들 추가
    const recallColumns = [
      'ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS recalled_at timestamptz;',
      'ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS recalled_by_user_id uuid;',
      'ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS recall_reason text;'
    ];

    for (const sql of recallColumns) {
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        console.error('회수 컬럼 추가 오류:', error);
      }
    }

    // 5. 폐기 관련 컬럼들 추가
    const disposeColumns = [
      'ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS disposed_at timestamptz;',
      'ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS disposed_by_user_id uuid;',
      'ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS disposal_reason text;'
    ];

    for (const sql of disposeColumns) {
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        console.error('폐기 컬럼 추가 오류:', error);
      }
    }

    // 6. 인덱스 추가
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_vouchers_phone ON vouchers(phone);',
      'CREATE INDEX IF NOT EXISTS idx_vouchers_recalled_at ON vouchers(recalled_at);',
      'CREATE INDEX IF NOT EXISTS idx_vouchers_disposed_at ON vouchers(disposed_at);'
    ];

    for (const sql of indexes) {
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        console.error('인덱스 추가 오류:', error);
      }
    }

    // 7. 현재 테이블 구조 확인
    const { data: tableInfo, error: tableInfoError } = await supabase
      .from('information_schema.columns')
      .select('column_name, is_nullable, data_type')
      .eq('table_name', 'vouchers')
      .eq('table_schema', 'public')
      .order('ordinal_position');

    if (tableInfoError) {
      console.error('테이블 정보 조회 오류:', tableInfoError);
    }

    console.log('교환권 상태 마이그레이션 완료');

    return NextResponse.json({
      success: true,
      message: '교환권 상태 체계가 성공적으로 업데이트되었습니다.',
      data: {
        newStatuses: ['registered', 'issued', 'used', 'recalled', 'disposed'],
        addedColumns: ['phone', 'recalled_at', 'recalled_by_user_id', 'recall_reason', 'disposed_at', 'disposed_by_user_id', 'disposal_reason'],
        tableStructure: tableInfo
      }
    });

  } catch (error) {
    console.error('교환권 상태 마이그레이션 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '마이그레이션 중 오류가 발생했습니다.',
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