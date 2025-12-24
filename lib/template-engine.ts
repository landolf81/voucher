import { generateVoucherCodes, VoucherData } from './voucher-codes';

interface TemplateVariable {
  key: string;
  value: string | number;
  type: 'text' | 'number' | 'qr_code' | 'barcode' | 'image';
}

interface VoucherTemplateData extends VoucherData {
  // 추가 필드들
  issue_date?: string;
  expiry_date?: string;
  issuer_name?: string;
  note?: string;
}

/**
 * 템플릿 변수 치환 엔진
 */
export class VoucherTemplateEngine {
  private static VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;
  private static FIELD_PATTERN = /data-field="(\w+)"/g;

  /**
   * HTML 템플릿에서 모든 변수 추출
   */
  static extractVariables(htmlTemplate: string): string[] {
    const variables = new Set<string>();
    
    // {{variable}} 패턴 추출
    let match;
    while ((match = this.VARIABLE_PATTERN.exec(htmlTemplate)) !== null) {
      variables.add(match[1]);
    }
    
    // data-field="variable" 패턴 추출
    this.FIELD_PATTERN.lastIndex = 0;
    while ((match = this.FIELD_PATTERN.exec(htmlTemplate)) !== null) {
      variables.add(match[1]);
    }
    
    return Array.from(variables);
  }

  /**
   * 템플릿 변수를 실제 데이터로 치환
   */
  static async replaceVariables(
    htmlTemplate: string, 
    voucherData: VoucherTemplateData,
    options?: {
      codeFormat?: 'svg' | 'dataurl';
      qrCodeSize?: number;
      barcodeWidth?: number;
      barcodeHeight?: number;
    }
  ): Promise<string> {
    const codeFormat = options?.codeFormat || 'dataurl';
    
    // QR코드/바코드 생성
    const codes = await generateVoucherCodes(voucherData, codeFormat);
    
    // 날짜 포맷팅
    const formattedData = this.formatVoucherData(voucherData);
    
    // 변수 매핑
    const variables: Record<string, string> = {
      ...formattedData,
      qr_code: this.generateQRCodeHTML(codes.qrCode, options?.qrCodeSize),
      barcode: this.generateBarcodeHTML(codes.barcode, options?.barcodeWidth, options?.barcodeHeight)
    };
    
    // 템플릿 치환 수행
    let processedHtml = htmlTemplate;
    
    // {{variable}} 패턴 치환
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processedHtml = processedHtml.replace(regex, value);
    });
    
    return processedHtml;
  }

  /**
   * 교환권 데이터 포맷팅
   */
  private static formatVoucherData(data: VoucherTemplateData): Record<string, string> {
    return {
      association: data.association || '',
      member_id: data.member_id || '',
      name: data.name || '',
      dob: this.formatDate(data.dob),
      amount: this.formatAmount(data.amount),
      serial_no: data.serial_no || '',
      issue_date: this.formatDate(data.issue_date),
      expiry_date: this.formatDate(data.expiry_date),
      issuer_name: data.issuer_name || '',
      note: data.note || '',
      site_id: data.site_id || ''
    };
  }

  /**
   * 날짜 포맷팅 (YYYY-MM-DD → YYYY년 MM월 DD일)
   */
  private static formatDate(dateString?: string): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      
      return `${year}년 ${month.toString().padStart(2, '0')}월 ${day.toString().padStart(2, '0')}일`;
    } catch {
      return dateString;
    }
  }

  /**
   * 금액 포맷팅 (숫자 → #,###원)
   */
  private static formatAmount(amount: number): string {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  }

  /**
   * QR코드 HTML 생성
   */
  private static generateQRCodeHTML(qrCode: string, size?: number): string {
    const defaultSize = size || 120;
    
    if (qrCode.startsWith('<svg')) {
      // SVG 형식
      return `<div style="display: inline-block; width: ${defaultSize}px; height: ${defaultSize}px;">${qrCode}</div>`;
    } else if (qrCode.startsWith('data:image')) {
      // Data URL 형식
      return `<img src="${qrCode}" alt="QR Code" style="width: ${defaultSize}px; height: ${defaultSize}px; display: block; margin: 0 auto;" />`;
    } else {
      // 대체 텍스트
      return `<div style="width: ${defaultSize}px; height: ${defaultSize}px; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #666; margin: 0 auto;">QR CODE</div>`;
    }
  }

  /**
   * 바코드 HTML 생성
   */
  private static generateBarcodeHTML(barcode: string, width?: number, height?: number): string {
    const defaultWidth = width || 200;
    const defaultHeight = height || 50;
    
    if (barcode.startsWith('<svg')) {
      // SVG 형식
      return `<div style="display: inline-block; width: ${defaultWidth}px; height: ${defaultHeight}px;">${barcode}</div>`;
    } else if (barcode.startsWith('data:image')) {
      // Data URL 형식
      return `<img src="${barcode}" alt="Barcode" style="width: ${defaultWidth}px; height: ${defaultHeight}px; display: block; margin: 0 auto;" />`;
    } else {
      // 대체 텍스트
      return `<div style="width: ${defaultWidth}px; height: ${defaultHeight}px; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #666; margin: 0 auto;">BARCODE</div>`;
    }
  }

  /**
   * 템플릿 유효성 검사
   */
  static validateTemplate(htmlTemplate: string): {
    isValid: boolean;
    missingVariables: string[];
    errors: string[];
  } {
    const errors: string[] = [];
    const variables = this.extractVariables(htmlTemplate);
    const requiredFields = ['association', 'member_id', 'name', 'amount', 'serial_no'];
    const missingVariables = requiredFields.filter(field => !variables.includes(field));
    
    // 필수 필드 검사
    if (missingVariables.length > 0) {
      errors.push(`필수 필드가 누락되었습니다: ${missingVariables.join(', ')}`);
    }
    
    // HTML 구조 검사
    if (!htmlTemplate.trim()) {
      errors.push('템플릿이 비어있습니다.');
    }
    
    if (!htmlTemplate.includes('{{') && !htmlTemplate.includes('data-field=')) {
      errors.push('변수 필드가 없습니다. {{변수명}} 또는 data-field="변수명" 형식을 사용하세요.');
    }
    
    return {
      isValid: errors.length === 0,
      missingVariables,
      errors
    };
  }

  /**
   * 반응형 CSS 추가
   */
  static addResponsiveStyles(htmlTemplate: string): string {
    const responsiveCSS = `
      <style>
        /* 기본 스타일 */
        .voucher-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-family: 'Noto Sans KR', Arial, sans-serif;
          line-height: 1.6;
        }
        
        .voucher-field {
          margin: 10px 0;
          padding: 8px 12px;
          border-radius: 6px;
        }
        
        .voucher-field.association {
          background-color: #eff6ff;
          border: 2px solid #3b82f6;
          color: #1e40af;
          font-weight: bold;
        }
        
        .voucher-field.member-id {
          background-color: #f0fdf4;
          border: 2px solid #10b981;
          color: #065f46;
        }
        
        .voucher-field.name {
          background-color: #fefce8;
          border: 2px solid #f59e0b;
          color: #92400e;
          font-weight: bold;
          font-size: 18px;
        }
        
        .voucher-field.amount {
          background-color: #f0fdf4;
          border: 3px solid #059669;
          color: #059669;
          font-weight: bold;
          font-size: 24px;
          text-align: center;
        }
        
        /* 모바일 스타일 */
        @media screen and (max-width: 768px) {
          .voucher-container {
            padding: 15px;
            max-width: 100%;
          }
          
          .voucher-field {
            font-size: 16px;
            padding: 12px;
            margin: 12px 0;
          }
          
          .voucher-field.name {
            font-size: 20px;
          }
          
          .voucher-field.amount {
            font-size: 28px;
            padding: 20px;
          }
          
          .qr-code, .barcode {
            text-align: center;
            margin: 20px 0;
          }
        }
        
        /* 인쇄 스타일 */
        @media print {
          .voucher-container {
            width: 190mm;
            height: 277mm;
            margin: 10mm;
            padding: 15mm;
            page-break-after: always;
          }
          
          .voucher-field {
            font-size: 14px;
            margin: 8px 0;
            padding: 8px;
          }
          
          .voucher-field.name {
            font-size: 18px;
          }
          
          .voucher-field.amount {
            font-size: 20px;
            padding: 12px;
          }
          
          .qr-code img, .barcode img {
            max-width: 80px;
            max-height: 80px;
          }
        }
      </style>
    `;
    
    if (htmlTemplate.includes('<head>')) {
      return htmlTemplate.replace('<head>', `<head>${responsiveCSS}`);
    } else if (htmlTemplate.includes('<html>')) {
      return htmlTemplate.replace('<html>', `<html><head>${responsiveCSS}</head>`);
    } else {
      return `${responsiveCSS}${htmlTemplate}`;
    }
  }

  /**
   * 배치 처리 - 여러 교환권 동시 생성
   */
  static async generateBatchVouchers(
    htmlTemplate: string,
    vouchersData: VoucherTemplateData[],
    options?: {
      codeFormat?: 'svg' | 'dataurl';
      includeResponsiveCSS?: boolean;
    }
  ): Promise<string[]> {
    const results: string[] = [];
    
    for (const voucherData of vouchersData) {
      try {
        let processedHtml = await this.replaceVariables(htmlTemplate, voucherData, {
          codeFormat: options?.codeFormat || 'dataurl'
        });
        
        if (options?.includeResponsiveCSS !== false) {
          processedHtml = this.addResponsiveStyles(processedHtml);
        }
        
        // 각 교환권을 컨테이너로 감싸기
        processedHtml = `<div class="voucher-container">${processedHtml}</div>`;
        
        results.push(processedHtml);
      } catch (error) {
        console.error(`Failed to generate voucher for ${voucherData.serial_no}:`, error);
        results.push(`<div class="voucher-container error">교환권 생성 실패: ${voucherData.serial_no}</div>`);
      }
    }
    
    return results;
  }
}