import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// 일련번호 자동 생성 함수
function generateSerialNumber() {
  const today = new Date();
  const dateStr = today.toISOString().slice(2,10).replace(/-/g,''); // YYMMDD
  const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  const checkDigit = Math.floor(Math.random() * 10);
  return `${dateStr}${randomNum}${checkDigit}`;
}

// CSV 파일 처리 및 일괄 등록 API
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const templateId = formData.get('template_id') as string;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message: 'CSV 파일이 필요합니다.'
        },
        { status: 400 }
      );
    }

    console.log('CSV 대량 등록 API 호출:', { fileName: file.name, templateId });

    // CSV 파일 읽기 - 다중 인코딩 시도
    let text: string;
    const buffer = await file.arrayBuffer();
    
    // 여러 인코딩으로 시도
    const encodings = ['utf-8', 'euc-kr', 'cp949', 'iso-8859-1'];
    let bestText = '';
    let bestScore = 0;
    
    for (const encoding of encodings) {
      try {
        const decoder = new TextDecoder(encoding, { fatal: false });
        const decodedText = decoder.decode(buffer);
        
        // 한국어 문자가 올바르게 디코딩되었는지 점수 계산
        const koreanChars = (decodedText.match(/[가-힣]/g) || []).length;
        const totalChars = decodedText.length;
        const invalidChars = (decodedText.match(/[�]/g) || []).length;
        const garbledChars = (decodedText.match(/[㎤㎥㎡㏄㏘]/g) || []).length;
        
        const score = koreanChars - (invalidChars * 10) - (garbledChars * 5);
        
        console.log(`${encoding} 인코딩 시도: 한글 ${koreanChars}자, 깨진문자 ${invalidChars}개, 점수 ${score}`);
        
        if (score > bestScore) {
          bestScore = score;
          bestText = decodedText;
        }
      } catch (error) {
        console.log(`${encoding} 인코딩 실패:`, error instanceof Error ? error.message : error);
      }
    }
    
    if (!bestText) {
      // 모든 인코딩 실패 시 UTF-8로 강제 시도
      const decoder = new TextDecoder('utf-8', { fatal: false });
      bestText = decoder.decode(buffer);
    }
    
    text = bestText;
    console.log(`최종 선택된 인코딩으로 디코딩된 텍스트 샘플:`, text.substring(0, 200));
    
    // BOM 제거 (UTF-8 BOM: \uFEFF)
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }
    
    console.log('파일 읽기 성공, 첫 100자:', text.substring(0, 100));
    const lines = text.split(/\r?\n/).filter(line => line.trim()); // Windows/Unix 줄바꿈 모두 처리
    
    if (lines.length < 2) {
      return NextResponse.json(
        {
          success: false,
          message: 'CSV 파일에 데이터가 없습니다.'
        },
        { status: 400 }
      );
    }

    // CSV 구분자 감지 및 헤더 파싱
    const firstLine = lines[0];
    let delimiter = ',';
    
    // 구분자 자동 감지 (쉼표, 탭, 세미콜론)
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    
    if (tabCount > commaCount && tabCount > semicolonCount) {
      delimiter = '\t';
      console.log('탭 구분자 감지');
    } else if (semicolonCount > commaCount) {
      delimiter = ';';
      console.log('세미콜론 구분자 감지');
    } else {
      console.log('쉼표 구분자 사용');
    }
    
    // 강력한 CSV 파싱 함수
    function parseCSVLine(line: string): string[] {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      let i = 0;
      
      // 빈 줄 처리
      if (!line.trim()) return [];
      
      while (i < line.length) {
        const char = line[i];
        const nextChar = i < line.length - 1 ? line[i + 1] : '';
        
        if (char === '"') {
          if (!inQuotes) {
            // 따옴표 시작
            inQuotes = true;
          } else if (nextChar === '"') {
            // 이스케이프된 따옴표 ("")
            current += '"';
            i++; // 다음 따옴표 건너뛰기
          } else {
            // 따옴표 끝
            inQuotes = false;
          }
        } else if (char === delimiter && !inQuotes) {
          // 구분자 발견 (따옴표 밖에서)
          result.push(current.trim().replace(/^"|"$/g, '')); // 앞뒤 따옴표 제거
          current = '';
        } else {
          current += char;
        }
        i++;
      }
      
      // 마지막 필드 추가
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    }
    
    const headers = parseCSVLine(lines[0]);
    console.log('감지된 헤더:', headers);
    
    const expectedHeaders = ['serial_no', 'amount', 'association', 'member_id', 'name', 'dob', 'phone', 'notes'];
    
    // 필수 헤더 확인 (serial_no는 선택사항)
    const requiredHeaders = ['amount', 'association', 'member_id', 'name', 'dob'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `필수 컬럼이 누락되었습니다: ${missingHeaders.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 데이터 행 파싱 및 처리
    const vouchers: any[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        const row: any = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        // 디버깅: 파싱된 행 데이터 로깅
        if (i <= 3) {
          console.log(`${i + 1}행 파싱 결과:`, row);
        }

        // 필수 필드 검증
        if (!row.amount || !row.association || !row.member_id || !row.name || !row.dob) {
          errors.push(`${i + 1}행: 필수 필드가 누락되었습니다.`);
          continue;
        }

        // 금액 검증
        const amount = parseInt(row.amount);
        if (isNaN(amount) || amount <= 0) {
          errors.push(`${i + 1}행: 올바른 금액을 입력해주세요.`);
          continue;
        }

        // 날짜 형식 검증
        const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dobRegex.test(row.dob)) {
          errors.push(`${i + 1}행: 생년월일 형식이 올바르지 않습니다. (YYYY-MM-DD)`);
          continue;
        }

        // 일련번호 처리 (공란이면 자동 생성)
        let serialNo = row.serial_no;
        if (!serialNo) {
          // 중복되지 않는 일련번호 생성
          let isUnique = false;
          let attempts = 0;
          while (!isUnique && attempts < 100) {
            serialNo = generateSerialNumber();
            
            // 기존 DB에서 중복 확인
            const { data: existing } = await supabase
              .from('vouchers')
              .select('id')
              .eq('serial_no', serialNo)
              .maybeSingle();
              
            // 현재 배치에서 중복 확인
            const duplicateInBatch = vouchers.some(v => v.serial_no === serialNo);
            
            if (!existing && !duplicateInBatch) {
              isUnique = true;
            }
            attempts++;
          }
          
          if (!isUnique) {
            errors.push(`${i + 1}행: 고유한 일련번호 생성에 실패했습니다.`);
            continue;
          }
        } else {
          // 입력된 일련번호의 중복 확인
          const { data: existing } = await supabase
            .from('vouchers')
            .select('id')
            .eq('serial_no', serialNo)
            .maybeSingle();
            
          const duplicateInBatch = vouchers.some(v => v.serial_no === serialNo);
          
          if (existing || duplicateInBatch) {
            errors.push(`${i + 1}행: 일련번호 '${serialNo}'가 이미 존재합니다.`);
            continue;
          }
        }

        vouchers.push({
          template_id: templateId || null,
          serial_no: serialNo,
          amount,
          association: row.association,
          member_id: row.member_id,
          name: row.name,
          dob: row.dob,
          phone: row.phone || null,
          status: 'registered', // 새로운 상태 체계: 등록부터 시작
          notes: row.notes || null
        });

      } catch (error) {
        console.error(`${i + 1}행 처리 오류:`, error);
        errors.push(`${i + 1}행: 데이터 처리 중 오류가 발생했습니다.`);
      }
    }

    // 오류가 있으면 중단
    if (errors.length > 0) {
      console.error('데이터 검증 오류들:', errors);
      return NextResponse.json(
        {
          success: false,
          message: '일부 데이터에 오류가 있습니다.',
          errors: errors.slice(0, 10), // 최대 10개 오류만 표시
          totalErrors: errors.length,
          processedRows: lines.length - 1
        },
        { status: 400 }
      );
    }

    // 유효한 데이터가 없으면 중단
    if (vouchers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '등록할 유효한 데이터가 없습니다.'
        },
        { status: 400 }
      );
    }

    // 데이터베이스에 일괄 삽입
    const { data: insertedVouchers, error: insertError } = await supabase
      .from('vouchers')
      .insert(vouchers)
      .select();

    if (insertError) {
      console.error('일괄 삽입 오류:', insertError);
      return NextResponse.json(
        {
          success: false,
          message: '데이터베이스 저장 중 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }

    console.log(`${vouchers.length}개 교환권 일괄 등록 완료`);

    return NextResponse.json({
      success: true,
      message: `${vouchers.length}개의 교환권이 성공적으로 등록되었습니다.`,
      data: {
        count: vouchers.length,
        vouchers: insertedVouchers
      }
    });

  } catch (error) {
    console.error('CSV 일괄 등록 API 오류:', error);
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