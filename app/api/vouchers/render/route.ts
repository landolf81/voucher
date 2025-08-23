import { NextRequest, NextResponse } from 'next/server';
import { VoucherTemplateEngine } from '@/lib/template-engine';

interface VoucherRenderRequest {
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
  renderMode: 'mobile' | 'print' | 'preview';
  options?: {
    codeFormat?: 'svg' | 'dataurl';
    includeResponsiveCSS?: boolean;
    qrCodeSize?: number;
    barcodeWidth?: number;
    barcodeHeight?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: VoucherRenderRequest = await request.json();
    
    // 요청 데이터 검증
    if (!body.voucherData || !body.templateHtml) {
      return NextResponse.json(
        { error: '필수 데이터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const { voucherData, templateHtml, renderMode, options = {} } = body;

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

    // 현재 날짜 추가 (issue_date가 없는 경우)
    const processedVoucherData = {
      ...voucherData,
      issue_date: voucherData.issue_date || new Date().toISOString().split('T')[0]
    };

    // 렌더 모드에 따른 옵션 조정
    const renderOptions = {
      codeFormat: options.codeFormat || 'dataurl' as const,
      qrCodeSize: options.qrCodeSize || (renderMode === 'mobile' ? 150 : 100),
      barcodeWidth: options.barcodeWidth || (renderMode === 'mobile' ? 250 : 200),
      barcodeHeight: options.barcodeHeight || (renderMode === 'mobile' ? 60 : 50)
    };

    // 템플릿 변수 치환
    let processedHtml = await VoucherTemplateEngine.replaceVariables(
      templateHtml,
      processedVoucherData,
      renderOptions
    );

    // 반응형 CSS 추가 (옵션에 따라)
    if (options.includeResponsiveCSS !== false) {
      processedHtml = VoucherTemplateEngine.addResponsiveStyles(processedHtml);
    }

    // 렌더 모드별 추가 스타일
    if (renderMode === 'mobile') {
      processedHtml = addMobileStyles(processedHtml);
    } else if (renderMode === 'print') {
      processedHtml = addPrintStyles(processedHtml);
    }

    return NextResponse.json({
      success: true,
      html: processedHtml,
      voucherData: processedVoucherData,
      renderMode
    });

  } catch (error) {
    console.error('Voucher render error:', error);
    
    return NextResponse.json(
      { 
        error: '교환권 렌더링 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}

/**
 * 모바일 전용 스타일 추가
 */
function addMobileStyles(html: string): string {
  const mobileCSS = `
    <style>
      /* 모바일 전용 스타일 */
      body {
        margin: 0;
        padding: 10px;
        font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background-color: #f8f9fa;
      }
      
      .voucher-container {
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        margin: 0 auto;
        max-width: 400px;
      }
      
      .voucher-field {
        padding: 16px !important;
        margin: 0 !important;
        border-left: none !important;
        border-right: none !important;
        border-radius: 0 !important;
        border-bottom: 1px solid #e5e7eb;
      }
      
      .voucher-field:last-child {
        border-bottom: none;
      }
      
      .voucher-field.amount {
        background: linear-gradient(135deg, #10b981, #059669) !important;
        color: white !important;
        text-align: center;
        font-size: 32px !important;
        font-weight: bold;
        padding: 24px !important;
      }
      
      .qr-code, .barcode {
        text-align: center;
        padding: 20px;
        background: #f9fafb;
      }
      
      .qr-code img, .barcode img {
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
      
      /* 터치 친화적인 요소 */
      .voucher-field {
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    </style>
  `;
  
  return mobileCSS + html;
}

/**
 * 인쇄 전용 스타일 추가
 */
function addPrintStyles(html: string): string {
  const printCSS = `
    <style>
      /* 인쇄 전용 스타일 */
      @media print {
        * {
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        body {
          margin: 0;
          padding: 0;
          background: white;
        }
        
        .voucher-container {
          width: 190mm !important;
          height: 277mm !important;
          margin: 10mm !important;
          padding: 15mm !important;
          page-break-after: always;
          box-shadow: none !important;
          border: 2px solid #000 !important;
        }
        
        .voucher-field {
          margin: 8px 0 !important;
          padding: 10px !important;
          border: 1px solid #333 !important;
          font-size: 14px !important;
          page-break-inside: avoid;
        }
        
        .voucher-field.amount {
          font-size: 24px !important;
          border: 3px solid #000 !important;
          font-weight: bold;
          text-align: center;
        }
        
        .qr-code img, .barcode img {
          max-width: 80px !important;
          max-height: 80px !important;
        }
        
        /* 페이지 나누기 방지 */
        .voucher-container {
          page-break-inside: avoid;
        }
      }
      
      @page {
        size: A4;
        margin: 10mm;
      }
    </style>
  `;
  
  return printCSS + html;
}