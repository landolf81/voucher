import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// CSV 일괄 교환권 사용 등록 스키마
const csvBulkRegisterUseSchema = z.object({
  site_id: z.string().optional(), // 요청자의 사이트 (관리자용)
  bulk_notes: z.string().optional()
});

// CSV 행 데이터 스키마
const csvRowSchema = z.object({
  serial_no: z.string().min(1, '일련번호를 입력해주세요.'),
  used_date: z.string().regex(/^\d{4}[-\/]\d{2}[-\/]\d{2}$/, '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD 또는 YYYY/MM/DD)'),
  site_code: z.string().min(1, '사용처 코드를 입력해주세요.'),
  notes: z.string().optional()
});

interface ProcessedVoucher {
  serial_no: string;
  used_date: string;
  site_code: string;
  site_id?: string;
  site_name?: string;
  notes?: string;
}

interface ProcessingResult {
  serial_no: string;
  success: boolean;
  message: string;
  site_name?: string;
  used_date?: string;
}

// CSV 파일 파싱 함수
function parseCSV(csvText: string): string[][] {
  const lines = csvText.trim().split(/\r?\n/);
  const result: string[][] = [];
  
  for (const line of lines) {
    if (line.trim() === '') continue;
    
    // 간단한 CSV 파싱 (콤마로 분할, 따옴표 처리)
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim());
    
    result.push(fields);
  }
  
  return result;
}

// 날짜 형식 정규화 (YYYY/MM/DD → YYYY-MM-DD)
function normalizeDateFormat(dateStr: string): string {
  return dateStr.replace(/\//g, '-');
}

// 배치 처리 함수
async function processBatch(
  supabase: any,
  batch: ProcessedVoucher[],
  bulkNotes: string | undefined
): Promise<ProcessingResult[]> {
  const results: ProcessingResult[] = [];
  const serialNos = batch.map(v => v.serial_no);
  
  // 배치 단위로 교환권 조회
  const { data: vouchers, error: findError } = await supabase
    .from('vouchers')
    .select('*')
    .in('serial_no', serialNos);

  if (findError) {
    console.error('배치 교환권 조회 오류:', findError);
    return batch.map(v => ({
      serial_no: v.serial_no,
      success: false,
      message: '교환권 조회 중 오류가 발생했습니다.'
    }));
  }

  // 교환권 맵 생성
  const voucherMap = new Map(vouchers?.map((v: any) => [v.serial_no, v]) || []);
  
  // 업데이트할 교환권과 감사 로그 준비
  const toUpdate: any[] = [];
  const auditLogs: any[] = [];
  
  for (const voucherData of batch) {
    const voucher = voucherMap.get(voucherData.serial_no);
    
    if (!voucher) {
      results.push({
        serial_no: voucherData.serial_no,
        success: false,
        message: '해당 일련번호의 교환권을 찾을 수 없습니다.'
      });
      continue;
    }

    // 교환권 상태 확인
    if ((voucher as any).status !== 'issued') {
      let statusMessage = '';
      switch ((voucher as any).status) {
        case 'used':
          statusMessage = '이미 사용된 교환권입니다.';
          break;
        case 'recalled':
          statusMessage = '회수된 교환권은 사용할 수 없습니다.';
          break;
        case 'disposed':
          statusMessage = '폐기된 교환권은 사용할 수 없습니다.';
          break;
        case 'registered':
          statusMessage = '아직 발행되지 않은 교환권입니다.';
          break;
        default:
          statusMessage = '사용할 수 없는 상태입니다.';
      }
      
      results.push({
        serial_no: voucherData.serial_no,
        success: false,
        message: statusMessage
      });
      continue;
    }

    // 업데이트 준비
    toUpdate.push({
      id: (voucher as any).id,
      serial_no: (voucher as any).serial_no,
      status: 'used',
      used_at: `${voucherData.used_date}T${new Date().toTimeString().substring(0, 8)}Z`,
      used_by_user_id: null,
      used_at_site_id: voucherData.site_id,
      notes: [voucherData.notes, bulkNotes].filter(Boolean).join(' | ') || null
    });

    // 감사 로그 준비
    auditLogs.push({
      voucher_id: (voucher as any).id,
      action: 'voucher_csv_usage_registered',
      actor_user_id: null,
      site_id: voucherData.site_id,
      details: {
        serial_no: voucherData.serial_no,
        site_code: voucherData.site_code,
        site_name: voucherData.site_name,
        used_date: voucherData.used_date,
        voucher_amount: (voucher as any).amount,
        individual_notes: voucherData.notes,
        bulk_notes: bulkNotes,
        previous_status: (voucher as any).status,
        new_status: 'used',
        registered_at: new Date().toISOString(),
        csv_upload: true
      }
    });

    results.push({
      serial_no: voucherData.serial_no,
      success: true,
      message: '교환권 사용이 성공적으로 등록되었습니다.',
      site_name: voucherData.site_name,
      used_date: voucherData.used_date
    });
  }

  // 배치 업데이트 실행
  if (toUpdate.length > 0) {
    for (const update of toUpdate) {
      const { id, ...updateData } = update;
      const { error: updateError } = await supabase
        .from('vouchers')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error(`교환권 업데이트 오류 (${update.serial_no}):`, updateError);
        // 해당 결과를 실패로 변경
        const resultIndex = results.findIndex(r => r.serial_no === update.serial_no);
        if (resultIndex !== -1) {
          results[resultIndex] = {
            serial_no: update.serial_no,
            success: false,
            message: '교환권 업데이트 중 오류가 발생했습니다.'
          };
        }
      }
    }

    // 감사 로그 배치 삽입
    if (auditLogs.length > 0) {
      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert(auditLogs);

      if (auditError) {
        console.error('감사 로그 배치 삽입 오류:', auditError);
      }
    }
  }

  return results;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const siteId = formData.get('site_id') as string;
    const bulkNotes = formData.get('bulk_notes') as string;

    console.log('CSV 일괄 교환권 사용 등록 API 호출:', { 
      fileName: file?.name, 
      siteId, 
      bulkNotes: bulkNotes?.substring(0, 50) + '...' 
    });

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message: 'CSV 파일이 필요합니다.'
        },
        { status: 400 }
      );
    }

    // CSV 파일 읽기
    const csvText = await file.text();
    console.log('CSV 내용 첫 100자:', csvText.substring(0, 100));

    // CSV 파싱
    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'CSV 파일이 비어있습니다.'
        },
        { status: 400 }
      );
    }

    // 헤더 확인 및 제거
    const headers = rows[0];
    const dataRows = rows.slice(1);
    
    console.log('CSV 헤더:', headers);
    console.log('데이터 행 수:', dataRows.length);
    console.log('첫 5개 데이터 행:', dataRows.slice(0, 5));

    if (dataRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'CSV 파일에 데이터가 없습니다.'
        },
        { status: 400 }
      );
    }

    // 대량 데이터 처리 제한
    const MAX_ROWS = 5000;
    if (dataRows.length > MAX_ROWS) {
      return NextResponse.json(
        {
          success: false,
          message: `한 번에 처리할 수 있는 최대 행 수는 ${MAX_ROWS}개입니다. 현재 ${dataRows.length}개`,
          totalRows: dataRows.length,
          maxAllowed: MAX_ROWS
        },
        { status: 400 }
      );
    }

    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 사이트 코드 매핑 조회 (한 번만)
    const { data: sites, error: sitesError } = await supabase
      .from('sites')
      .select('id, site_name, short_code');

    if (sitesError) {
      console.error('사이트 조회 오류:', sitesError);
      return NextResponse.json(
        {
          success: false,
          message: '사이트 정보를 조회할 수 없습니다.'
        },
        { status: 500 }
      );
    }

    // 코드 → 사이트 매핑 생성 (short_code와 site_name 둘 다 매핑)
    const siteCodeMap = new Map<string, { id: string; name: string }>();
    sites?.forEach(site => {
      // short_code가 있으면 사용
      if (site.short_code) {
        siteCodeMap.set(site.short_code.toUpperCase(), {
          id: site.id,
          name: site.site_name
        });
      }
      
      // site_name의 첫 단어도 코드로 사용 (예: "클린마트" → "클린")
      const firstWord = site.site_name.split(/[\s-]/)[0];
      if (firstWord && !siteCodeMap.has(firstWord.toUpperCase())) {
        siteCodeMap.set(firstWord.toUpperCase(), {
          id: site.id,
          name: site.site_name
        });
      }
      
      // site_name 전체도 코드로 사용
      if (!siteCodeMap.has(site.site_name.toUpperCase())) {
        siteCodeMap.set(site.site_name.toUpperCase(), {
          id: site.id,
          name: site.site_name
        });
      }
    });

    console.log('사이트 코드 매핑:', Array.from(siteCodeMap.entries()));
    
    // 사이트 코드가 없는 경우 경고
    if (siteCodeMap.size === 0) {
      console.warn('경고: 사이트 코드 매핑이 비어있습니다. sites 테이블의 short_code 필드를 확인하세요.');
      return NextResponse.json(
        {
          success: false,
          message: '사이트 코드가 설정되지 않았습니다. 관리자에게 문의하세요.',
          availableSites: sites?.map(s => ({
            id: s.id,
            name: s.site_name,
            code: s.short_code || '미설정'
          }))
        },
        { status: 500 }
      );
    }

    // 데이터 검증 및 처리
    const processedVouchers: ProcessedVoucher[] = [];
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2; // 헤더 포함한 실제 행 번호

      try {
        // 필드 개수 검증
        if (row.length < 3) {
          errors.push(`${rowNumber}행: 필수 필드가 부족합니다. (최소 3개: 일련번호, 사용일자, 사용처코드)`);
          continue;
        }

        const [serialNo, usedDate, siteCode, notes] = row;

        // 개별 필드 검증
        const validation = csvRowSchema.safeParse({
          serial_no: serialNo?.trim(),
          used_date: usedDate?.trim(),
          site_code: siteCode?.trim().toUpperCase(),
          notes: notes?.trim()
        });

        if (!validation.success) {
          const fieldErrors = validation.error.errors.map(e => e.message).join(', ');
          errors.push(`${rowNumber}행: ${fieldErrors}`);
          continue;
        }

        const validatedData = validation.data;

        // 사용처 코드 매핑 확인 (대소문자 구분 없이)
        console.log(`${rowNumber}행 사용처 코드 확인:`, {
          originalCode: siteCode?.trim(),
          upperCode: validatedData.site_code,
          availableCodes: Array.from(siteCodeMap.keys())
        });
        
        const siteInfo = siteCodeMap.get(validatedData.site_code);
        if (!siteInfo) {
          errors.push(`${rowNumber}행: 유효하지 않은 사용처 코드 '${validatedData.site_code}' (사용 가능한 코드: ${Array.from(siteCodeMap.keys()).join(', ')})`);
          continue;
        }

        processedVouchers.push({
          serial_no: validatedData.serial_no,
          used_date: normalizeDateFormat(validatedData.used_date),
          site_code: validatedData.site_code,
          site_id: siteInfo.id,
          site_name: siteInfo.name,
          notes: validatedData.notes
        });

      } catch (error) {
        console.error(`${rowNumber}행 처리 오류:`, error);
        errors.push(`${rowNumber}행: 데이터 처리 중 오류가 발생했습니다.`);
      }
    }

    // 검증 오류가 있으면 상세 정보와 함께 반환
    if (errors.length > 0) {
      console.error('데이터 검증 오류들:', errors);
      
      // 사용 가능한 사이트 코드 목록 제공
      const availableSiteCodes = Array.from(siteCodeMap.entries()).map(([code, site]) => ({
        code: code,
        name: site.name
      }));
      
      return NextResponse.json(
        {
          success: false,
          message: '일부 데이터에 오류가 있습니다.',
          errors: errors.slice(0, 20), // 최대 20개 오류 표시
          totalErrors: errors.length,
          processedRows: dataRows.length,
          availableSiteCodes: availableSiteCodes,
          expectedFormat: {
            columns: ['일련번호', '사용일자(YYYY-MM-DD)', '사용처코드', '비고(선택)'],
            example: ['VCH-2024-001', '2024-12-25', 'SITE01', '테스트 사용']
          }
        },
        { status: 400 }
      );
    }

    if (processedVouchers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '처리할 유효한 데이터가 없습니다.'
        },
        { status: 400 }
      );
    }

    console.log(`${processedVouchers.length}개 교환권 처리 시작`);

    // 배치 처리
    const BATCH_SIZE = 100; // 한 번에 처리할 배치 크기
    const allResults: ProcessingResult[] = [];
    
    for (let i = 0; i < processedVouchers.length; i += BATCH_SIZE) {
      const batch = processedVouchers.slice(i, i + BATCH_SIZE);
      console.log(`배치 처리 중: ${i + 1} ~ ${Math.min(i + BATCH_SIZE, processedVouchers.length)} / ${processedVouchers.length}`);
      
      const batchResults = await processBatch(supabase, batch, bulkNotes);
      allResults.push(...batchResults);
    }

    // 결과 집계
    const successCount = allResults.filter(r => r.success).length;
    const errorCount = allResults.filter(r => !r.success).length;

    console.log('CSV 일괄 교환권 사용 등록 완료:', {
      total: processedVouchers.length,
      success: successCount,
      error: errorCount
    });

    // 전체 결과 반환
    const overallSuccess = successCount > 0;
    const statusCode = errorCount === 0 ? 200 : (successCount === 0 ? 400 : 207); // 207: Multi-Status

    // 디버깅: 실패한 결과들의 처음 10개 로그
    const failedResults = allResults.filter(r => !r.success);
    console.log('실패한 처리 결과 (처음 10개):', failedResults.slice(0, 10));

    return NextResponse.json({
      success: overallSuccess,
      message: `총 ${processedVouchers.length}개 중 ${successCount}개 사용 등록 성공, ${errorCount}개 실패`,
      summary: {
        total: processedVouchers.length,
        success: successCount,
        error: errorCount,
        available_site_codes: Array.from(siteCodeMap.entries()).map(([code, site]) => `${code}: ${site.name}`)
      },
      results: allResults,
      // 디버깅을 위해 실패한 첫 20개 결과 포함
      failedSamples: failedResults.slice(0, 20),
      csv_upload: {
        file_name: file.name,
        bulk_notes: bulkNotes,
        processed_at: new Date().toISOString()
      }
    }, { status: statusCode });

  } catch (error) {
    console.error('CSV 일괄 교환권 사용 등록 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      {
        success: false,
        message: `CSV 처리 중 오류가 발생했습니다: ${errorMessage}`,
        error: error instanceof Error ? error.toString() : String(error)
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