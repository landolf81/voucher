import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getMobileRenderer } from '@/lib/mobile-voucher-renderer';
import { z } from 'zod';
import JSZip from 'jszip';

// 모바일 일괄 다운로드 스키마
const mobileBatchDownloadSchema = z.object({
  voucher_ids: z.array(z.string().uuid()).min(1, '최소 1개의 교환권이 필요합니다.').max(100, '한 번에 최대 100개까지 다운로드 가능합니다.'),
  template_id: z.string().uuid('유효하지 않은 템플릿 ID입니다.'),
  batch_name: z.string().min(1).max(100).optional().default('교환권_묶음'),
  width: z.number().positive().max(1000).optional().default(400),
  height: z.number().positive().max(1000).optional().default(400),
  format: z.enum(['png', 'jpeg']).optional().default('png'),
  quality: z.number().min(10).max(100).optional().default(90)
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('모바일 일괄 다운로드 API 호출:', {
      voucher_count: body.voucher_ids?.length,
      template_id: body.template_id,
      batch_name: body.batch_name
    });

    // 입력 검증
    const validation = mobileBatchDownloadSchema.safeParse(body);
    if (!validation.success) {
      console.error('입력 검증 실패:', validation.error.errors);
      return NextResponse.json(
        {
          success: false,
          message: '입력 정보가 올바르지 않습니다.',
          errors: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { voucher_ids, template_id, batch_name, width, height, format, quality } = validation.data;

    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 교환권 데이터 조회
    const { data: vouchers, error: vouchersError } = await supabase
      .from('vouchers')
      .select('*')
      .in('id', voucher_ids)
      .order('serial_no');

    if (vouchersError || !vouchers || vouchers.length === 0) {
      console.error('교환권 조회 오류:', vouchersError);
      return NextResponse.json(
        {
          success: false,
          message: '교환권을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    // 모바일 렌더러 인스턴스 가져오기
    const renderer = getMobileRenderer();

    // 템플릿 데이터 가져오기
    const template = await renderer.getTemplate(template_id);
    if (!template) {
      return NextResponse.json(
        {
          success: false,
          message: '템플릿을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    // 렌더링 옵션 설정
    const renderOptions = {
      width,
      height,
      format,
      quality,
      background: true
    };

    // ZIP 파일 생성
    const zip = new JSZip();
    let successCount = 0;
    let errorCount = 0;

    // 각 교환권에 대해 이미지 생성
    for (let i = 0; i < vouchers.length; i++) {
      const voucher = vouchers[i];
      
      try {
        console.log(`Rendering voucher ${i + 1}/${vouchers.length}: ${voucher.serial_no}`);
        
        // 교환권 데이터 변환
        const voucherData = {
          id: voucher.id,
          serial_no: voucher.serial_no,
          amount: voucher.amount,
          association: voucher.association,
          name: voucher.name,
          member_id: voucher.member_id,
          issued_at: voucher.issued_at
        };

        // 이미지 렌더링
        const imageBuffer = await renderer.renderVoucher(voucherData, template, renderOptions);
        
        // ZIP에 파일 추가
        const filename = `${voucher.name}_${voucher.serial_no}.${format}`;
        zip.file(filename, imageBuffer);
        
        successCount++;
        
      } catch (error) {
        console.error(`교환권 ${voucher.serial_no} 렌더링 실패:`, error);
        errorCount++;
        
        // 오류 텍스트 파일을 ZIP에 추가
        const errorText = `교환권 ${voucher.serial_no} 렌더링 오류\n오류 내용: ${error}\n시간: ${new Date().toISOString()}`;
        zip.file(`ERROR_${voucher.serial_no}.txt`, errorText);
      }
    }

    // 요약 정보 파일 추가
    const summaryText = `
교환권 일괄 다운로드 요약

배치명: ${batch_name}
템플릿 ID: ${template_id}
전체 수량: ${vouchers.length}개
성공: ${successCount}개
실패: ${errorCount}개
생성 시간: ${new Date().toLocaleString('ko-KR')}
이미지 형식: ${format.toUpperCase()}
이미지 크기: ${width} × ${height}px

교환권 목록:
${vouchers.map((v, i) => `${i + 1}. ${v.name} (${v.serial_no}) - ${v.amount.toLocaleString()}원`).join('\n')}
`;

    zip.file('다운로드_요약.txt', summaryText);

    // ZIP 파일 생성
    console.log('ZIP 파일 생성 중...');
    const zipBuffer = await zip.generateAsync({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    // 파일명 생성 (안전한 파일명으로 변환)
    const safeFilename = batch_name.replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    const filename = `${safeFilename}_${successCount}개_${timestamp}.zip`;

    // 응답 헤더 설정
    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    headers.set('Content-Length', zipBuffer.length.toString());
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    // 감사 로그 기록 (비동기, 실패해도 응답에 영향 없음)
    (async () => {
      try {
        await supabase
          .from('audit_logs')
          .insert({
            action: 'mobile_batch_download',
            details: {
              batch_name,
              template_id,
              voucher_count: vouchers.length,
              success_count: successCount,
              error_count: errorCount,
              format,
              width,
              height,
              voucher_serials: vouchers.map(v => v.serial_no)
            }
          });
        console.log('Batch download audit log recorded');
      } catch (error: any) {
        console.error('Audit log failed:', error);
      }
    })();

    console.log(`ZIP 생성 완료: ${filename} (${zipBuffer.length} bytes)`);

    return new NextResponse(zipBuffer as BodyInit, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('모바일 일괄 다운로드 API 오류:', error);
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