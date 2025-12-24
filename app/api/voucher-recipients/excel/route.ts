import { NextRequest, NextResponse } from 'next/server';

// POST: 엑셀 파일을 파싱하여 발행대상자 데이터를 반환
export async function POST(request: NextRequest) {
  try {
    console.log('엑셀 파일 파싱 API 호출');

    const formData = await request.formData();
    const file = formData.get('excelFile') as File;
    const templateId = formData.get('template_id') as string;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message: '엑셀 파일을 선택해주세요.'
        },
        { status: 400 }
      );
    }

    if (!templateId) {
      return NextResponse.json(
        {
          success: false,
          message: '교환권 템플릿을 선택해주세요.'
        },
        { status: 400 }
      );
    }

    // 파일 내용을 텍스트로 읽기 (CSV 형태로 가정)
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    // 헤더 행 제외하고 데이터 행만 처리
    const dataLines = lines.slice(1);
    
    console.log(`CSV 데이터 파싱 완료: ${dataLines.length}개 행`);

    // 데이터 검증 및 변환
    const recipients = [];
    const errors = [];

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      const rowNum = i + 2; // CSV 행 번호 (헤더 포함)

      try {
        // 빈 행 건너뛰기
        if (!line) {
          continue;
        }

        // CSV 파싱 (쉼표로 분할)
        const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
        
        // 컬럼 수 확인
        if (columns.length < 6) {
          errors.push(`${rowNum}행: 필수 컬럼이 부족합니다. (최소 6개 컬럼 필요)`);
          continue;
        }

        const [member_id, farming_association, name, dob, phone, amountStr, notes = ''] = columns;

        // 필수 필드 검증
        if (!member_id || !farming_association || !name || !dob || !phone || !amountStr) {
          errors.push(`${rowNum}행: 필수 필드가 누락되었습니다.`);
          continue;
        }

        // 날짜 형식 검증
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
          errors.push(`${rowNum}행: 생년월일 형식이 올바르지 않습니다 (YYYY-MM-DD)`);
          continue;
        }

        // 금액 검증
        const amount = parseInt(amountStr);
        if (isNaN(amount) || amount <= 0) {
          errors.push(`${rowNum}행: 금액이 올바르지 않습니다.`);
          continue;
        }

        recipients.push({
          member_id: member_id.trim(),
          farming_association: farming_association.trim(),
          name: name.trim(),
          dob: dob.trim(),
          phone: phone.trim(),
          amount: amount,
          notes: notes.trim(),
          row: rowNum
        });

      } catch (error) {
        errors.push(`${rowNum}행: 데이터 처리 중 오류가 발생했습니다.`);
      }
    }

    console.log(`파싱 결과: 성공 ${recipients.length}개, 오류 ${errors.length}개`);

    // 파싱된 데이터를 bulk API로 전송
    try {
      const bulkResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/voucher-recipients/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: templateId,
          recipients: recipients
        })
      });

      const bulkResult = await bulkResponse.json();
      
      if (bulkResult.success) {
        return NextResponse.json({
          success: true,
          message: `${bulkResult.insertedCount}개의 발행대상자가 성공적으로 등록되었습니다.`,
          insertedCount: bulkResult.insertedCount,
          totalCount: recipients.length,
          errorCount: errors.length + (bulkResult.errorCount || 0),
          parseErrors: errors.slice(0, 10), // 파싱 오류
          insertErrors: bulkResult.errors || [] // 삽입 오류
        });
      } else {
        return NextResponse.json({
          success: false,
          message: bulkResult.message || '일괄 등록에 실패했습니다.',
          parseErrors: errors,
          insertErrors: bulkResult.errors || []
        }, { status: 400 });
      }
    } catch (bulkError) {
      console.error('Bulk API 호출 오류:', bulkError);
      return NextResponse.json({
        success: false,
        message: '일괄 등록 처리 중 오류가 발생했습니다.',
        parseErrors: errors
      }, { status: 500 });
    }

  } catch (error) {
    console.error('엑셀 파싱 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '엑셀 파일 처리 중 오류가 발생했습니다.'
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