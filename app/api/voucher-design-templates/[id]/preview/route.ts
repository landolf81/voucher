import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { VoucherTemplateEngine } from '@/lib/template-engine';

// 샘플 교환권 데이터
const SAMPLE_VOUCHER_DATA = {
  serial_no: 'VCH-2025-SAMPLE-001',
  amount: 100000,
  association: '성주참외영농조합법인',
  member_id: '001',
  name: '홍길동',
  dob: '1985-03-15',
  site_id: 'sample-site',
  issue_date: new Date().toISOString().split('T')[0],
  expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  issuer_name: '관리자',
  note: '미리보기용 샘플 교환권입니다.'
};

// GET: 디자인 템플릿 미리보기
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'a4'; // 'a4' | 'mobile'

    if (!templateId) {
      return NextResponse.json(
        { success: false, message: '템플릿 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 템플릿 조회
    const { data: template, error } = await supabase
      .from('voucher_design_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error || !template) {
      console.error('템플릿 조회 오류:', error);
      return NextResponse.json(
        { success: false, message: '디자인 템플릿을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 모드에 따라 적절한 템플릿 HTML 선택
    let templateHtml = mode === 'mobile'
      ? template.mobile_template_html
      : template.template_html;

    // 템플릿 HTML이 없는 경우 기본 템플릿 생성
    if (!templateHtml) {
      templateHtml = generateDefaultTemplate(mode);
    }

    // 템플릿 변수 치환
    const renderOptions = {
      codeFormat: 'dataurl' as const,
      qrCodeSize: mode === 'mobile' ? 150 : 100,
      barcodeWidth: mode === 'mobile' ? 250 : 200,
      barcodeHeight: mode === 'mobile' ? 60 : 50
    };

    let processedHtml = await VoucherTemplateEngine.replaceVariables(
      templateHtml,
      SAMPLE_VOUCHER_DATA,
      renderOptions
    );

    // 반응형 CSS 추가
    processedHtml = VoucherTemplateEngine.addResponsiveStyles(processedHtml);

    // 모드별 추가 스타일
    if (mode === 'mobile') {
      processedHtml = addMobileStyles(processedHtml);
    } else {
      processedHtml = addA4Styles(processedHtml);
    }

    // HTML 문서로 감싸기
    const fullHtml = wrapInHtmlDocument(processedHtml, mode);

    // HTML 응답 반환
    return new NextResponse(fullHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('템플릿 미리보기 오류:', error);
    return NextResponse.json(
      { success: false, message: '미리보기 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 기본 템플릿 생성
 */
function generateDefaultTemplate(mode: string): string {
  if (mode === 'mobile') {
    return `
      <div class="voucher-container mobile">
        <div class="voucher-header">
          <div class="voucher-field association">{{association}}</div>
        </div>
        <div class="voucher-body">
          <div class="voucher-field amount">{{amount}}</div>
          <div class="voucher-info">
            <div class="voucher-field member-id">조합원번호: {{member_id}}</div>
            <div class="voucher-field name">성명: {{name}}</div>
          </div>
          <div class="voucher-field serial">{{serial_no}}</div>
        </div>
        <div class="voucher-codes">
          <div class="qr-code">{{qr_code}}</div>
          <div class="barcode">{{barcode}}</div>
        </div>
        <div class="voucher-footer">
          <div class="voucher-field date">발행일: {{issue_date}}</div>
          <div class="voucher-field expiry">유효기간: {{expiry_date}}</div>
        </div>
      </div>
    `;
  }

  // A4 기본 템플릿
  return `
    <div class="voucher-container a4">
      <div class="voucher-header">
        <h1 class="voucher-title">교환권</h1>
        <div class="voucher-field association">{{association}}</div>
      </div>
      <div class="voucher-body">
        <div class="voucher-main">
          <div class="voucher-field amount">{{amount}}</div>
        </div>
        <div class="voucher-details">
          <table class="details-table">
            <tr>
              <th>조합원번호</th>
              <td class="voucher-field member-id">{{member_id}}</td>
            </tr>
            <tr>
              <th>성명</th>
              <td class="voucher-field name">{{name}}</td>
            </tr>
            <tr>
              <th>교환권번호</th>
              <td class="voucher-field serial">{{serial_no}}</td>
            </tr>
            <tr>
              <th>발행일</th>
              <td class="voucher-field date">{{issue_date}}</td>
            </tr>
            <tr>
              <th>유효기간</th>
              <td class="voucher-field expiry">{{expiry_date}}</td>
            </tr>
          </table>
        </div>
        <div class="voucher-codes">
          <div class="qr-code">{{qr_code}}</div>
          <div class="barcode">{{barcode}}</div>
        </div>
      </div>
      <div class="voucher-footer">
        <p>본 교환권은 {{association}}에서 발행한 정식 교환권입니다.</p>
      </div>
    </div>
  `;
}

/**
 * 모바일 전용 스타일 추가
 */
function addMobileStyles(html: string): string {
  const mobileCSS = `
    <style>
      body {
        margin: 0;
        padding: 10px;
        font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background-color: #f8f9fa;
      }

      .voucher-container.mobile {
        background: white;
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        max-width: 400px;
        margin: 0 auto;
      }

      .voucher-header {
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        color: white;
        padding: 20px;
        text-align: center;
      }

      .voucher-field.association {
        font-size: 18px;
        font-weight: bold;
      }

      .voucher-body {
        padding: 20px;
      }

      .voucher-field.amount {
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        font-size: 32px;
        font-weight: bold;
        text-align: center;
        padding: 24px;
        border-radius: 12px;
        margin-bottom: 16px;
      }

      .voucher-info {
        background: #f9fafb;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
      }

      .voucher-field.member-id,
      .voucher-field.name {
        padding: 8px 0;
        border-bottom: 1px solid #e5e7eb;
        font-size: 16px;
      }

      .voucher-field.name {
        border-bottom: none;
        font-weight: bold;
      }

      .voucher-field.serial {
        text-align: center;
        font-family: monospace;
        font-size: 14px;
        color: #6b7280;
        padding: 12px;
        background: #f3f4f6;
        border-radius: 8px;
      }

      .voucher-codes {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 20px;
        background: #f9fafb;
      }

      .qr-code img, .barcode img {
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .voucher-footer {
        padding: 16px 20px;
        background: #f3f4f6;
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: #6b7280;
      }
    </style>
  `;

  return mobileCSS + html;
}

/**
 * A4 인쇄용 스타일 추가
 */
function addA4Styles(html: string): string {
  const a4CSS = `
    <style>
      body {
        margin: 0;
        padding: 20px;
        font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background-color: #e5e7eb;
      }

      .voucher-container.a4 {
        background: white;
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 20mm;
        box-sizing: border-box;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      }

      .voucher-header {
        text-align: center;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 3px solid #3b82f6;
      }

      .voucher-title {
        font-size: 36px;
        color: #1f2937;
        margin: 0 0 10px 0;
      }

      .voucher-field.association {
        font-size: 24px;
        color: #3b82f6;
        font-weight: bold;
      }

      .voucher-body {
        padding: 20px 0;
      }

      .voucher-main {
        text-align: center;
        margin-bottom: 30px;
      }

      .voucher-field.amount {
        display: inline-block;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        font-size: 48px;
        font-weight: bold;
        padding: 30px 60px;
        border-radius: 16px;
      }

      .voucher-details {
        margin-bottom: 30px;
      }

      .details-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 16px;
      }

      .details-table th {
        text-align: left;
        padding: 12px 16px;
        background: #f3f4f6;
        width: 150px;
        border: 1px solid #e5e7eb;
      }

      .details-table td {
        padding: 12px 16px;
        border: 1px solid #e5e7eb;
      }

      .voucher-codes {
        display: flex;
        justify-content: center;
        gap: 40px;
        padding: 30px;
        background: #f9fafb;
        border-radius: 12px;
        margin-bottom: 30px;
      }

      .qr-code, .barcode {
        text-align: center;
      }

      .voucher-footer {
        text-align: center;
        padding-top: 20px;
        border-top: 1px solid #e5e7eb;
        color: #6b7280;
        font-size: 14px;
      }

      @media print {
        body {
          background: white;
          padding: 0;
        }

        .voucher-container.a4 {
          box-shadow: none;
          width: 100%;
          height: 100%;
        }
      }
    </style>
  `;

  return a4CSS + html;
}

/**
 * HTML 문서로 감싸기
 */
function wrapInHtmlDocument(content: string, mode: string): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>교환권 미리보기 (${mode === 'mobile' ? '모바일' : 'A4'})</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body>
  ${content}
</body>
</html>
  `;
}
