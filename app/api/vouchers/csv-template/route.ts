import { NextRequest, NextResponse } from 'next/server';

// GET: CSV 템플릿 파일 다운로드
export async function GET(request: NextRequest) {
  try {
    // CSV 헤더와 예시 데이터
    const csvContent = `serial_no,amount,association,member_id,name,dob,phone,notes
,50000,성주사과농협,12345,홍길동,1980-01-01,010-1234-5678,VIP 고객
25081700001,30000,동암1리,67890,김철수,1975-05-15,010-2345-6789,
,25000,상동농협,11111,이영희,1990-12-31,010-3456-7890,단골 고객
25081700002,40000,성주과수농협,22222,박민수,1985-07-20,,우수 회원
,35000,성주농협,33333,최정호,1992-03-10,010-5678-9012,
,30000,동암2리,44444,윤미영,1988-11-25,010-6789-0123,신규 고객`;

    // UTF-8 BOM 추가하여 Excel에서도 한글이 제대로 표시되도록
    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;

    console.log('CSV 템플릿 다운로드 요청 (UTF-8 BOM 포함)');

    // CSV 파일로 응답
    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="voucher-template.csv"',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('CSV 템플릿 다운로드 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'CSV 템플릿 다운로드 중 오류가 발생했습니다.'
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