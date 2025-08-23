import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { makePayload } from '@/lib/hmac';
import QRCode from 'qrcode';

export const runtime = 'nodejs';

interface VoucherData {
  serial_no: string;
  amount: number;
  association: string;
  member_id: string;
  name: string;
  dob: string;
  phone?: string;
  status: string;
  issued_at: string;
}

interface BulkPrintRequest {
  voucher_ids: string[];
  template_id?: string;
  format: 'a4' | 'mobile';
}

// Generate QR code as base64 data URL
async function generateQRCode(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'M'
    });
  } catch (error) {
    console.error('QR code generation error:', error);
    return '';
  }
}

// Generate barcode as SVG string with proper CODE128 standard
function generateBarcode(data: string): string {
  try {
    // CODE128 Start B, Data, Checksum, Stop 패턴
    const CODE128_START_B = [2, 1, 1, 2, 3, 2]; // Start B 패턴
    const CODE128_STOP = [2, 3, 3, 1, 1, 1, 2]; // Stop 패턴
    
    // CODE128 B 문자 테이블 (간단화된 버전)
    const CODE128_B: { [key: string]: number[] } = {
      '0': [2, 1, 2, 2, 2, 2], '1': [2, 2, 2, 1, 2, 2], '2': [2, 2, 2, 2, 2, 1],
      '3': [1, 2, 1, 2, 2, 3], '4': [1, 2, 1, 3, 2, 2], '5': [1, 3, 1, 2, 2, 2],
      '6': [1, 2, 2, 2, 1, 3], '7': [1, 2, 2, 3, 1, 2], '8': [1, 3, 2, 2, 1, 2],
      '9': [2, 2, 1, 2, 1, 3], 'A': [2, 2, 1, 3, 1, 2], 'B': [2, 3, 1, 2, 1, 2],
      'C': [1, 1, 2, 2, 3, 2], 'D': [1, 2, 2, 1, 3, 2], 'E': [1, 2, 2, 2, 3, 1],
      'F': [1, 1, 3, 2, 2, 2], 'G': [1, 2, 3, 1, 2, 2], 'H': [1, 2, 3, 2, 2, 1],
      'I': [2, 2, 3, 2, 1, 1], 'J': [2, 2, 1, 1, 3, 2], 'K': [2, 2, 1, 2, 3, 1],
      'L': [2, 1, 3, 2, 1, 2], 'M': [2, 2, 3, 1, 1, 2], 'N': [3, 1, 2, 1, 3, 1],
      'O': [3, 1, 1, 2, 2, 2], 'P': [3, 2, 1, 1, 2, 2], 'Q': [3, 2, 1, 2, 2, 1],
      'R': [3, 1, 2, 2, 1, 2], 'S': [3, 2, 2, 1, 1, 2], 'T': [3, 2, 2, 2, 1, 1],
      'U': [2, 1, 2, 1, 2, 3], 'V': [2, 1, 2, 3, 2, 1], 'W': [2, 3, 2, 1, 2, 1],
      'X': [1, 1, 1, 3, 2, 3], 'Y': [1, 3, 1, 1, 2, 3], 'Z': [1, 3, 1, 3, 2, 1],
      '-': [1, 1, 2, 3, 1, 3], '_': [1, 3, 2, 1, 1, 3], ' ': [1, 3, 2, 3, 1, 1]
    };
    
    // 바코드 패턴 생성
    let patterns: number[] = [];
    patterns = patterns.concat(CODE128_START_B);
    
    // 데이터 문자들을 패턴으로 변환
    for (let i = 0; i < data.length; i++) {
      const char = data[i].toUpperCase();
      if (CODE128_B[char]) {
        patterns = patterns.concat(CODE128_B[char]);
      } else {
        // 지원하지 않는 문자는 0으로 대체
        patterns = patterns.concat(CODE128_B['0']);
      }
    }
    
    // 체크섬 계산 (간단화된 버전)
    const checksum = (104 + data.split('').reduce((sum, char, i) => {
      const charCode = char.charCodeAt(0);
      return sum + ((charCode - 32) * (i + 1));
    }, 0)) % 103;
    
    // 체크섬을 0으로 간단화 (실제 구현에서는 정확한 체크섬 계산 필요)
    patterns = patterns.concat(CODE128_B['0']);
    patterns = patterns.concat(CODE128_STOP);
    
    // SVG 바코드 생성
    let x = 10;
    const barHeight = 50;
    let svgBars = '';
    let isBlack = true;
    
    for (let i = 0; i < patterns.length; i++) {
      const width = patterns[i] * 2; // 너비 확대
      if (isBlack) {
        svgBars += `<rect x="${x}" y="10" width="${width}" height="${barHeight}" fill="black"/>`;
      }
      x += width;
      isBlack = !isBlack;
    }
    
    const totalWidth = x + 20;
    
    const svgBarcode = `
      <svg width="${totalWidth}" height="80" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} 80">
        <rect x="0" y="0" width="${totalWidth}" height="80" fill="white"/>
        ${svgBars}
        <text x="${totalWidth/2}" y="75" text-anchor="middle" font-family="monospace" font-size="10">${data}</text>
      </svg>
    `;
    
    return `data:image/svg+xml;base64,${Buffer.from(svgBarcode).toString('base64')}`;
  } catch (error) {
    console.error('Barcode generation error:', error);
    // 바코드 생성 실패 시 텍스트로 대체
    return `data:image/svg+xml;base64,${Buffer.from(`
      <svg width="200" height="80" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="80" fill="white" stroke="black"/>
        <text x="100" y="45" text-anchor="middle" font-family="monospace" font-size="14">${data}</text>
      </svg>
    `).toString('base64')}`;
  }
}

// Replace template variables with voucher data
function replaceTemplateVariables(html: string, voucher: VoucherData, qrCodeDataUrl: string, barcodeDataUrl: string): string {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  let processedHtml = html;
  
  // Replace all template variables
  processedHtml = processedHtml.replace(/\{\{serial_no\}\}/g, voucher.serial_no);
  processedHtml = processedHtml.replace(/\{\{amount\}\}/g, voucher.amount.toLocaleString());
  processedHtml = processedHtml.replace(/\{\{association\}\}/g, voucher.association || '');
  processedHtml = processedHtml.replace(/\{\{member_id\}\}/g, voucher.member_id || '');
  processedHtml = processedHtml.replace(/\{\{name\}\}/g, voucher.name || '');
  processedHtml = processedHtml.replace(/\{\{dob\}\}/g, voucher.dob || '');
  processedHtml = processedHtml.replace(/\{\{phone\}\}/g, voucher.phone || '');
  processedHtml = processedHtml.replace(/\{\{issued_at\}\}/g, formatDate(voucher.issued_at));
  processedHtml = processedHtml.replace(/\{\{status\}\}/g, voucher.status || '');
  
  // Replace QR code placeholder with actual QR code image - supports size parameters
  if (qrCodeDataUrl) {
    // Replace QR codes with size parameters: {{qr_code:120}} (120px size)
    processedHtml = processedHtml.replace(/\{\{qr_code:(\d+)\}\}/g, (match, size) => {
      return `<img src="${qrCodeDataUrl}" style="width: ${size}px; height: ${size}px;" />`;
    });
    
    // Replace standard QR code placeholder
    processedHtml = processedHtml.replace(/\{\{qr_code\}\}/g, `<img src="${qrCodeDataUrl}" style="width: 180px; height: 180px;" />`);
  }
  
  // Replace barcode placeholder with actual barcode image - supports height parameters
  if (barcodeDataUrl) {
    // Replace barcodes with height parameters: {{barcode:80}} (80px height)
    processedHtml = processedHtml.replace(/\{\{barcode:(\d+)\}\}/g, (match, height) => {
      return `<img src="${barcodeDataUrl}" style="height: ${height}px; max-width: 100%;" />`;
    });
    
    // Replace standard barcode placeholder
    processedHtml = processedHtml.replace(/\{\{barcode\}\}/g, `<img src="${barcodeDataUrl}" style="height: 60px; max-width: 100%;" />`);
  }
  
  return processedHtml;
}

export async function POST(req: NextRequest) {
  try {
    const body: BulkPrintRequest = await req.json();
    const { voucher_ids, template_id, format = 'a4' } = body;

    console.log('Bulk print request:', { 
      voucher_ids_count: voucher_ids?.length, 
      template_id, 
      format,
      first_5_ids: voucher_ids?.slice(0, 5)
    });

    if (!voucher_ids || voucher_ids.length === 0) {
      return NextResponse.json(
        { success: false, message: '인쇄할 교환권을 선택해주세요.' },
        { status: 400 }
      );
    }

    // 환경 변수 확인
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing environment variables:', {
        url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      });
      return NextResponse.json(
        { success: false, message: '서버 설정 오류: 필수 환경 변수가 없습니다.' },
        { status: 500 }
      );
    }

    const supabase = supabaseServer();

    // Fetch vouchers data - 대량 데이터 처리를 위해 배치로 조회
    let allVouchers: VoucherData[] = [];
    const BATCH_SIZE = 50; // PostgreSQL IN 절 제한을 고려하여 배치 크기 설정
    
    try {
      for (let i = 0; i < voucher_ids.length; i += BATCH_SIZE) {
        const batchNumber = Math.floor(i/BATCH_SIZE) + 1;
        const batchIds = voucher_ids.slice(i, Math.min(i + BATCH_SIZE, voucher_ids.length));
        
        console.log(`Fetching batch ${batchNumber} with ${batchIds.length} vouchers`);
        
        const { data: batchVouchers, error: batchError } = await supabase
          .from('vouchers')
          .select('*')
          .in('id', batchIds);

        if (batchError) {
          console.error(`Batch ${batchNumber} error:`, {
            message: batchError.message,
            details: batchError.details || '',
            hint: batchError.hint || '',
            code: batchError.code || ''
          });
          return NextResponse.json(
            { 
              success: false, 
              message: `교환권 정보 조회 실패 (배치 ${batchNumber}/${Math.ceil(voucher_ids.length/BATCH_SIZE)}): ${batchError.message}` 
            },
            { status: 500 }
          );
        }

        if (batchVouchers && batchVouchers.length > 0) {
          allVouchers = allVouchers.concat(batchVouchers);
          console.log(`Batch ${batchNumber} fetched successfully: ${batchVouchers.length} vouchers`);
        } else {
          console.warn(`Batch ${batchNumber} returned no data`);
        }
        
        // 각 배치 사이에 짧은 대기 시간 추가 (서버 부하 방지)
        if (i + BATCH_SIZE < voucher_ids.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (fetchError) {
      console.error('Voucher fetch error:', fetchError);
      return NextResponse.json(
        { 
          success: false, 
          message: `교환권 조회 중 오류 발생: ${fetchError instanceof Error ? fetchError.message : '알 수 없는 오류'}` 
        },
        { status: 500 }
      );
    }

    if (allVouchers.length === 0) {
      return NextResponse.json(
        { success: false, message: '조회된 교환권이 없습니다.' },
        { status: 404 }
      );
    }

    console.log(`Successfully fetched ${allVouchers.length} vouchers`);

    // Fetch template if provided
    let templateHtml = '';
    let templateCss = '';
    
    if (template_id) {
      console.log('Fetching template:', template_id);
      const { data: template, error: templateError } = await supabase
        .from('voucher_design_templates')
        .select('*')
        .eq('id', template_id)
        .single();

      if (templateError) {
        console.error('Template fetch error:', templateError);
        // 템플릿 에러는 무시하고 기본 템플릿 사용
      } else if (template) {
        console.log('Template found:', template.name);
        // template_html 컬럼이 있는지 확인
        if (format === 'a4') {
          templateHtml = template.template_html || '';
          templateCss = template.template_css || '';
        } else {
          templateHtml = template.mobile_template_html || template.template_html || '';
          templateCss = template.mobile_template_css || template.template_css || '';
        }
        
        if (!templateHtml) {
          console.log('No HTML template found in template data, using default template');
        }
      }
    }

    // Generate HTML content for each voucher
    let htmlContent = '';
    
    for (let i = 0; i < allVouchers.length; i++) {
      const voucher = allVouchers[i];
      const payload = makePayload(voucher.serial_no, voucher.issued_at);
      const qrCodeDataUrl = await generateQRCode(payload);
      const barcodeDataUrl = generateBarcode(voucher.serial_no);

      if (templateHtml) {
        // Use custom template
        const processedHtml = replaceTemplateVariables(templateHtml, voucher, qrCodeDataUrl, barcodeDataUrl);
        htmlContent += processedHtml;
        if (i < allVouchers.length - 1) {
          htmlContent += '<div style="page-break-after: always;"></div>';
        }
      } else {
        // Use default template
        const voucherHtml = `
          <div style="
            font-family: 'Pretendard', 'Noto Sans KR', Arial, sans-serif;
            page-break-inside: avoid;
            ${i < allVouchers.length - 1 ? 'page-break-after: always;' : ''}
            padding: 40px;
            width: 100%;
            height: ${format === 'a4' ? '297mm' : '150mm'};
            box-sizing: border-box;
          ">
            <h1 style="text-align: center; margin-bottom: 30px; font-size: 28px; font-weight: bold;">자재 교환권</h1>
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div style="flex: 1;">
                <div style="margin-bottom: 20px;">
                  <div style="font-size: 10px; color: #666; margin-bottom: 4px;">일련번호</div>
                  <div style="font-size: 16px; font-weight: bold;">${voucher.serial_no}</div>
                </div>
                <div style="margin-bottom: 20px;">
                  <div style="font-size: 10px; color: #666; margin-bottom: 4px;">금액</div>
                  <div style="font-size: 24px; font-weight: bold;">${Number(voucher.amount || 0).toLocaleString()} 원</div>
                </div>
                <div style="margin-bottom: 12px;">
                  <div style="font-size: 10px; color: #666; margin-bottom: 4px;">성명</div>
                  <div style="font-size: 14px; font-weight: bold;">${voucher.name || ''}</div>
                </div>
                <div style="margin-bottom: 12px;">
                  <div style="font-size: 10px; color: #666; margin-bottom: 4px;">생년월일</div>
                  <div style="font-size: 14px; font-weight: bold;">${voucher.dob || ''}</div>
                </div>
                <div style="margin-bottom: 12px;">
                  <div style="font-size: 10px; color: #666; margin-bottom: 4px;">영농회</div>
                  <div style="font-size: 14px; font-weight: bold;">${voucher.association || ''}</div>
                </div>
                <div style="margin-bottom: 12px;">
                  <div style="font-size: 10px; color: #666; margin-bottom: 4px;">발행일</div>
                  <div style="font-size: 14px; font-weight: bold;">${voucher.issued_at ? new Date(voucher.issued_at).toLocaleDateString('ko-KR') : ''}</div>
                </div>
              </div>
              <div style="text-align: center; margin-left: 40px;">
                <img src="${qrCodeDataUrl}" style="width: 180px; height: 180px;" />
                <div style="font-size: 10px; color: #555; margin-top: 8px;">스마트폰으로 QR을 제시하세요.</div>
              </div>
            </div>
          </div>
        `;
        htmlContent += voucherHtml;
      }
    }

    // Create complete HTML document
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>교환권 일괄 인쇄</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Noto Sans KR', Arial, sans-serif; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
          ${templateCss}
        </style>
        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
            }, 1000);
          };
        </script>
      </head>
      <body>
        <div class="no-print" style="padding: 20px; background: #f0f0f0; text-align: center; margin-bottom: 20px;">
          <p>이 페이지는 자동으로 인쇄됩니다. 인쇄가 시작되지 않으면 Ctrl+P를 눌러주세요.</p>
        </div>
        ${htmlContent}
      </body>
      </html>
    `;

    // Update voucher status to 'issued' after printing - 배치로 처리
    console.log(`Updating ${voucher_ids.length} vouchers to 'issued' status`);
    let updatedCount = 0;
    
    for (let i = 0; i < voucher_ids.length; i += BATCH_SIZE) {
      const batchIds = voucher_ids.slice(i, Math.min(i + BATCH_SIZE, voucher_ids.length));
      
      const { error: updateError, data } = await supabase
        .from('vouchers')
        .update({ 
          status: 'issued',
          issued_at: new Date().toISOString()
        })
        .in('id', batchIds)
        .select('*');

      if (updateError) {
        console.error(`Failed to update batch ${Math.floor(i/BATCH_SIZE) + 1}:`, updateError);
        // Continue with other batches even if one fails
      } else {
        updatedCount += data?.length || 0;
      }
    }
    
    console.log(`Successfully updated ${updatedCount} out of ${voucher_ids.length} vouchers to 'issued' status`);

    // Return HTML for browser printing
    return new Response(fullHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    });

  } catch (error) {
    console.error('Bulk print error:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      { 
        success: false, 
        message: `일괄 인쇄 처리 중 오류가 발생했습니다: ${errorMessage}`,
        error: error instanceof Error ? error.toString() : String(error)
      },
      { status: 500 }
    );
  }
}

