import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { z } from 'zod';

// 새로운 엑셀 데이터 검증 스키마 (교환권명, 금액 제외)
const excelRowSchema = z.object({
  member_id: z.string().min(1).max(50),
  farming_association: z.string().min(1).max(100),
  name: z.string().min(1).max(50),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '생년월일 형식이 올바르지 않습니다.'),
  phone: z.string().min(10).max(15),
  notes: z.string().optional().default('')
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const excelFile = formData.get('excelFile') as File;
    const voucherName = formData.get('voucherName') as string;
    const amount = formData.get('amount') as string;
    const voucherType = formData.get('voucherType') as string;
    const expiresAt = formData.get('expiresAt') as string;
    const usageLocation = formData.get('usageLocation') as string;

    if (!excelFile) {
      return NextResponse.json(
        {
          success: false,
          message: '엑셀 파일이 업로드되지 않았습니다.'
        },
        { status: 400 }
      );
    }

    if (!voucherName || !amount || !expiresAt || !usageLocation) {
      return NextResponse.json(
        {
          success: false,
          message: '교환권 기본정보(교환권명, 금액, 유효기간, 사용처)가 누락되었습니다.'
        },
        { status: 400 }
      );
    }

    // 파일 형식 검증
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];

    if (!allowedTypes.includes(excelFile.type)) {
      return NextResponse.json(
        {
          success: false,
          message: '엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.'
        },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (10MB)
    if (excelFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          message: '파일 크기는 10MB 이하여야 합니다.'
        },
        { status: 400 }
      );
    }

    // 파일 읽기
    const arrayBuffer = await excelFile.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // 첫 번째 시트 읽기
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      return NextResponse.json(
        {
          success: false,
          message: '엑셀 파일에 데이터가 없습니다.'
        },
        { status: 400 }
      );
    }

    // JSON으로 변환 (헤더 포함)
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    if (jsonData.length < 2) {
      return NextResponse.json(
        {
          success: false,
          message: '엑셀 파일에 헤더와 데이터가 모두 있어야 합니다.'
        },
        { status: 400 }
      );
    }

    // 헤더 검증 (교환권명, 금액 제외)
    const headers = jsonData[0];
    const expectedHeaders = ['조합원ID', '영농회', '이름', '생년월일', '휴대폰', '메모'];
    
    const headerMapping: Record<string, string> = {
      '조합원ID': 'member_id', 
      '영농회': 'farming_association',
      '이름': 'name',
      '생년월일': 'dob',
      '휴대폰': 'phone',
      '메모': 'notes'
    };

    // 필수 컬럼 확인 (메모는 선택사항)
    const requiredHeaders = ['조합원ID', '영농회', '이름', '생년월일', '휴대폰'];
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
    
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `필수 컬럼이 누락되었습니다: ${missingHeaders.join(', ')}`
        },
        { status: 400 }
      );
    }

    // 데이터 변환 및 검증
    const previewData: any[] = [];
    const errors: string[] = [];
    const amountValue = parseInt(amount, 10);

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      // 빈 행 건너뛰기
      if (row.every(cell => !cell)) continue;

      try {
        // 헤더에 맞춰 객체 생성
        const rowData: any = {};
        headers.forEach((header: string, index: number) => {
          const mappedKey = headerMapping[header];
          if (mappedKey) {
            let value = row[index];
            
            // 데이터 타입 변환
            if (mappedKey === 'dob') {
              // 날짜 형식 변환 (Excel 날짜는 숫자로 올 수 있음)
              if (typeof value === 'number') {
                const date = XLSX.SSF.parse_date_code(value);
                value = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
              } else if (value) {
                // 문자열 날짜 형식 정규화
                value = String(value).replace(/[-.]/g, '-');
                // YYYY-MM-DD 형식으로 변환
                if (value.match(/^\d{8}$/)) {
                  value = `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`;
                }
              }
            } else if (mappedKey === 'phone') {
              // 전화번호 형식 정리
              value = String(value || '').replace(/[^\d-]/g, '');
            }
            
            rowData[mappedKey] = value || '';
          }
        });

        // 데이터 검증
        const validation = excelRowSchema.safeParse(rowData);
        
        if (!validation.success) {
          errors.push(`${i+1}행: ${validation.error.errors.map(e => e.message).join(', ')}`);
          continue;
        }

        previewData.push({
          ...validation.data,
          voucher_name: voucherName,
          amount: amountValue,
          voucher_type: voucherType || 'fixed',
          expires_at: expiresAt,
          usage_location: usageLocation,
          row: i + 1
        });

      } catch (error) {
        errors.push(`${i+1}행: 데이터 처리 오류`);
      }
    }

    // 최대 1000개 제한
    if (previewData.length > 1000) {
      return NextResponse.json(
        {
          success: false,
          message: '한 번에 최대 1000개의 교환권만 발급할 수 있습니다.'
        },
        { status: 400 }
      );
    }

    // 오류가 너무 많으면 처리 중단
    if (errors.length > 50) {
      return NextResponse.json(
        {
          success: false,
          message: '데이터 오류가 너무 많습니다. 엑셀 파일을 다시 확인해주세요.',
          errors: errors.slice(0, 10) // 처음 10개만 표시
        },
        { status: 400 }
      );
    }

    console.log(`새로운 엑셀 파일 처리 완료: ${previewData.length}개 데이터, ${errors.length}개 오류`);

    return NextResponse.json({
      success: true,
      message: `${previewData.length}개의 수혜자 데이터를 성공적으로 불러왔습니다.`,
      previewData,
      voucherInfo: {
        voucher_name: voucherName,
        amount: amountValue,
        voucher_type: voucherType || 'fixed',
        expires_at: expiresAt,
        usage_location: usageLocation
      },
      totalRows: jsonData.length - 1,
      validRows: previewData.length,
      errorCount: errors.length,
      errors: errors.slice(0, 10) // 처음 10개 오류만 반환
    });

  } catch (error) {
    console.error('새로운 엑셀 파일 처리 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '엑셀 파일 처리 중 오류가 발생했습니다. 파일 형식을 확인해주세요.'
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
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}