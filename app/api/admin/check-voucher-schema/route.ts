import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// 교환권 테이블 스키마 확인 및 제약조건 체크 API
export async function GET(request: NextRequest) {
  try {
    console.log('교환권 테이블 스키마 확인');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. 현재 vouchers 테이블 구조 확인
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'vouchers' })
      .select();

    if (columnsError) {
      console.log('RPC 함수가 없으므로 다른 방법 시도');
    }

    // 2. 현재 데이터 샘플 확인
    const { data: sampleData, error: sampleError } = await supabase
      .from('vouchers')
      .select('*')
      .limit(3);

    if (sampleError) {
      console.error('샘플 데이터 조회 오류:', sampleError);
    }

    // 3. 중복 제약조건 체크 - serial_no 중복 확인
    const { data: duplicateSerials, error: duplicateError } = await supabase
      .from('vouchers')
      .select('serial_no')
      .order('serial_no');

    const serialNumbers = duplicateSerials?.map(v => v.serial_no) || [];
    const uniqueSerials = [...new Set(serialNumbers)];
    const hasDuplicateSerials = serialNumbers.length !== uniqueSerials.length;

    // 4. 현재 status 값들 확인
    const { data: statusData, error: statusError } = await supabase
      .from('vouchers')
      .select('status')
      .order('status');

    const statuses = [...new Set(statusData?.map(v => v.status) || [])];

    // 5. phone 컬럼 존재 여부 확인 (실제 데이터로)
    const { data: phoneCheck, error: phoneError } = await supabase
      .from('vouchers')
      .select('id, phone')
      .limit(1)
      .maybeSingle();

    const hasPhoneColumn = !phoneError;

    console.log('교환권 테이블 스키마 확인 완료');

    return NextResponse.json({
      success: true,
      message: '교환권 테이블 스키마 정보 조회 완료',
      data: {
        hasPhoneColumn,
        currentStatuses: statuses,
        totalVouchers: sampleData?.length || 0,
        sampleData: sampleData?.slice(0, 2), // 처음 2개만
        duplicateConstraints: {
          serial_no: {
            total: serialNumbers.length,
            unique: uniqueSerials.length,
            hasDuplicates: hasDuplicateSerials,
            duplicateSerials: hasDuplicateSerials ? 
              serialNumbers.filter((serial, index) => serialNumbers.indexOf(serial) !== index) : []
          }
        },
        phoneError: phoneError?.message,
        sampleError: sampleError?.message
      }
    });

  } catch (error) {
    console.error('스키마 확인 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '스키마 확인 중 오류가 발생했습니다.',
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}