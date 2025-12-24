import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { VoucherTemplateEngine } from '@/lib/template-engine';

interface VoucherPDFRequest {
  voucherData: {
    serial_no: string;
    amount: number;
    association: string;
    member_id: string;
    name: string;
    dob?: string;
    site_id: string;
    issue_date?: string;
    expiry_date?: string;
    issuer_name?: string;
    note?: string;
  };
  templateHtml: string;
  options?: {
    format?: 'A4' | 'A5' | 'Letter';
    orientation?: 'portrait' | 'landscape';
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
  };
}

export async function POST(request: NextRequest) {
  let browser;
  
  try {
    const body: VoucherPDFRequest = await request.json();
    
    // 요청 데이터 검증
    if (!body.voucherData || !body.templateHtml) {
      return NextResponse.json(
        { error: '필수 데이터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const { voucherData, templateHtml, options = {} } = body;

    // 템플릿 유효성 검사
    const validation = VoucherTemplateEngine.validateTemplate(templateHtml);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: '템플릿이 유효하지 않습니다.',
          details: validation.errors 
        },
        { status: 400 }
      );
    }

    // 현재 날짜 추가
    const processedVoucherData = {
      ...voucherData,
      issue_date: voucherData.issue_date || new Date().toISOString().split('T')[0]
    };

    // 템플릿 변수 치환
    let processedHtml = await VoucherTemplateEngine.replaceVariables(
      templateHtml,
      processedVoucherData,
      {
        codeFormat: 'dataurl',
        qrCodeSize: 100,
        barcodeWidth: 200,
        barcodeHeight: 50
      }
    );

    // PDF용 스타일 추가
    processedHtml = addPDFStyles(processedHtml);

    // 완전한 HTML 문서 생성
    const fullHtml = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>교환권 - ${voucherData.serial_no}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');
        </style>
      </head>
      <body>
        <div class="voucher-container">
          ${processedHtml}
        </div>
      </body>
      </html>
    `;

    // Puppeteer로 PDF 생성
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // 페이지 설정
    await page.setContent(fullHtml, {
      waitUntil: 'networkidle0'
    });

    // PDF 생성 옵션
    const pdfOptions = {
      format: options.format || 'A4' as const,
      orientation: options.orientation || 'portrait' as const,
      margin: {
        top: options.margin?.top || '20mm',
        right: options.margin?.right || '20mm',
        bottom: options.margin?.bottom || '20mm',
        left: options.margin?.left || '20mm'
      },
      printBackground: true,
      preferCSSPageSize: false
    };

    const pdfBuffer = await page.pdf(pdfOptions);
    
    await browser.close();

    // PDF 파일 반환
    return new NextResponse(pdfBuffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="voucher_${voucherData.serial_no}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    
    if (browser) {
      await browser.close().catch(console.error);
    }
    
    return NextResponse.json(
      { 
        error: 'PDF 생성 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}

/**
 * 배치 PDF 생성 엔드포인트
 */
export async function PUT(request: NextRequest) {
  let browser;
  
  try {
    const body: {
      vouchersData: VoucherPDFRequest['voucherData'][];
      templateHtml: string;
      options?: VoucherPDFRequest['options'];
    } = await request.json();
    
    if (!body.vouchersData || !Array.isArray(body.vouchersData) || !body.templateHtml) {
      return NextResponse.json(
        { error: '필수 데이터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const { vouchersData, templateHtml, options = {} } = body;

    // 템플릿 유효성 검사
    const validation = VoucherTemplateEngine.validateTemplate(templateHtml);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: '템플릿이 유효하지 않습니다.',
          details: validation.errors 
        },
        { status: 400 }
      );
    }

    // 배치 교환권 HTML 생성
    const processedVouchers = vouchersData.map(data => ({
      ...data,
      issue_date: data.issue_date || new Date().toISOString().split('T')[0]
    }));

    const voucherHtmls = await VoucherTemplateEngine.generateBatchVouchers(
      templateHtml,
      processedVouchers,
      {
        codeFormat: 'dataurl',
        includeResponsiveCSS: false
      }
    );

    // 모든 교환권을 하나의 HTML로 결합
    const combinedHtml = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>교환권 배치 - ${vouchersData.length}개</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');
          ${getPDFBatchStyles()}
        </style>
      </head>
      <body>
        ${voucherHtmls.join('\n')}
      </body>
      </html>
    `;

    // Puppeteer로 PDF 생성
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    await page.setContent(combinedHtml, {
      waitUntil: 'networkidle0'
    });

    const pdfOptions = {
      format: options.format || 'A4' as const,
      orientation: options.orientation || 'portrait' as const,
      margin: {
        top: options.margin?.top || '10mm',
        right: options.margin?.right || '10mm',
        bottom: options.margin?.bottom || '10mm',
        left: options.margin?.left || '10mm'
      },
      printBackground: true,
      preferCSSPageSize: false
    };

    const pdfBuffer = await page.pdf(pdfOptions);
    
    await browser.close();

    const timestamp = new Date().toISOString().split('T')[0];
    
    return new NextResponse(pdfBuffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="vouchers_batch_${timestamp}_${vouchersData.length}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    });

  } catch (error) {
    console.error('Batch PDF generation error:', error);
    
    if (browser) {
      await browser.close().catch(console.error);
    }
    
    return NextResponse.json(
      { 
        error: '배치 PDF 생성 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}

/**
 * PDF용 스타일 추가
 */
function addPDFStyles(html: string): string {
  const pdfCSS = `
    <style>
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      body {
        font-family: 'Noto Sans KR', Arial, sans-serif;
        margin: 0;
        padding: 0;
        background: white;
        line-height: 1.6;
      }
      
      .voucher-container {
        width: 100%;
        max-width: 190mm;
        margin: 0 auto;
        padding: 15mm;
        background: white;
        border: 2px solid #000;
        page-break-after: always;
        page-break-inside: avoid;
      }
      
      .voucher-field {
        margin: 8px 0;
        padding: 10px;
        border: 1px solid #333;
        border-radius: 4px;
        font-size: 14px;
        page-break-inside: avoid;
      }
      
      .voucher-field.association {
        background-color: #eff6ff !important;
        border: 2px solid #3b82f6 !important;
        color: #1e40af !important;
        font-weight: bold;
      }
      
      .voucher-field.member-id {
        background-color: #f0fdf4 !important;
        border: 2px solid #10b981 !important;
        color: #065f46 !important;
      }
      
      .voucher-field.name {
        background-color: #fefce8 !important;
        border: 2px solid #f59e0b !important;
        color: #92400e !important;
        font-weight: bold;
        font-size: 18px;
      }
      
      .voucher-field.amount {
        background-color: #f0fdf4 !important;
        border: 3px solid #059669 !important;
        color: #059669 !important;
        font-weight: bold;
        font-size: 24px;
        text-align: center;
        padding: 15px;
      }
      
      .voucher-field.serial-no {
        font-family: monospace;
        background-color: #f9fafb !important;
        border: 2px solid #6b7280 !important;
        color: #374151 !important;
      }
      
      .qr-code, .barcode {
        text-align: center;
        margin: 12px 0;
        page-break-inside: avoid;
      }
      
      .qr-code img, .barcode img {
        max-width: 80px;
        max-height: 80px;
        border: 1px solid #ccc;
      }
      
      @page {
        size: A4;
        margin: 0;
      }
    </style>
  `;
  
  return pdfCSS + html;
}

/**
 * 배치 PDF용 스타일
 */
function getPDFBatchStyles(): string {
  return `
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    body {
      font-family: 'Noto Sans KR', Arial, sans-serif;
      margin: 0;
      padding: 0;
      background: white;
      line-height: 1.4;
    }
    
    .voucher-container {
      width: 190mm;
      height: 277mm;
      margin: 0;
      padding: 10mm;
      background: white;
      border: 2px solid #000;
      page-break-after: always;
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    
    .voucher-container:last-child {
      page-break-after: auto;
    }
    
    .voucher-field {
      margin: 6px 0;
      padding: 8px;
      border: 1px solid #333;
      border-radius: 3px;
      font-size: 12px;
      page-break-inside: avoid;
    }
    
    .voucher-field.amount {
      font-size: 20px !important;
      text-align: center;
      font-weight: bold;
      border: 3px solid #059669 !important;
      background-color: #f0fdf4 !important;
      color: #059669 !important;
      padding: 12px;
    }
    
    .qr-code img, .barcode img {
      max-width: 60px !important;
      max-height: 60px !important;
    }
    
    @page {
      size: A4;
      margin: 0;
    }
  `;
}