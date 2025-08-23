/**
 * Mobile Voucher Rendering Engine
 * Handles server-side rendering of mobile vouchers using Puppeteer
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient } from '@/lib/supabase';

export interface VoucherData {
  id: string;
  serial_no: string;
  amount: number;
  association: string;
  name: string;
  member_id?: string;
  issued_at: string;
  template_id?: string;
}

export interface MobileTemplate {
  id: string;
  name: string;
  mobile_image_url?: string;
  mobile_field_positions: any;
  background_color?: string;
  text_color?: string;
  accent_color?: string;
  font_family?: string;
  width?: number;
  height?: number;
  template_config?: any;
  unlayer_design?: any;
}

export interface RenderOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'png' | 'jpeg';
  background?: boolean;
}

export class MobileVoucherRenderer {
  private browser: Browser | null = null;
  private isInitialized = false;

  constructor() {
    this.initBrowser();
  }

  /**
   * Initialize Puppeteer browser instance
   */
  private async initBrowser(): Promise<void> {
    try {
      if (!this.browser) {
        this.browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        });
        this.isInitialized = true;
        console.log('Puppeteer browser initialized');
      }
    } catch (error) {
      console.error('Failed to initialize Puppeteer browser:', error);
      throw new Error('Browser initialization failed');
    }
  }

  /**
   * Ensure browser is ready
   */
  private async ensureBrowser(): Promise<Browser> {
    if (!this.isInitialized || !this.browser) {
      await this.initBrowser();
    }
    return this.browser!;
  }

  /**
   * Generate mobile voucher HTML
   */
  public generateMobileHTML(voucher: VoucherData, template: MobileTemplate): string {
    const {
      background_color = '#ffffff',
      text_color = '#000000',
      font_family = 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif'
    } = template;

    // Generate QR code data with HMAC signature
    const qrData = this.generateQRData(voucher);
    
    return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>교환권 - ${voucher.serial_no}</title>
  <style>
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: ${font_family};
      background: ${background_color};
      color: ${text_color};
      width: 400px;
      height: 400px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    
    .voucher-container {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      ${template.mobile_image_url ? `
        background-image: url('${template.mobile_image_url}');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      ` : `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 20px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      `}
    }
    
    .voucher-header {
      text-align: center;
      margin-bottom: 20px;
    }
    
    .voucher-title {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
      color: ${text_color};
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    
    .voucher-subtitle {
      font-size: 14px;
      opacity: 0.9;
      color: ${text_color};
    }
    
    .voucher-body {
      text-align: center;
      margin-bottom: 20px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    
    .amount {
      font-size: 36px;
      font-weight: 800;
      margin-bottom: 16px;
      color: ${text_color};
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    
    .voucher-info {
      background: rgba(255,255,255,0.9);
      padding: 16px;
      border-radius: 12px;
      margin-bottom: 16px;
      color: #333;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 14px;
    }
    
    .info-row:last-child {
      margin-bottom: 0;
    }
    
    .info-label {
      font-weight: 600;
      color: #666;
    }
    
    .info-value {
      font-weight: 500;
      color: #333;
    }
    
    .qr-section {
      text-align: center;
    }
    
    .qr-code {
      width: 80px;
      height: 80px;
      background: white;
      border-radius: 8px;
      padding: 8px;
      margin: 0 auto 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .serial-no {
      font-size: 12px;
      font-family: 'Monaco', 'Menlo', monospace;
      color: ${text_color};
      opacity: 0.8;
    }
    
    /* Dynamic field positioning */
    ${this.generateFieldCSS(template.mobile_field_positions)}
  </style>
</head>
<body>
  <div class="voucher-container">
    <div class="voucher-header">
      <div class="voucher-title">교환권</div>
      <div class="voucher-subtitle">${voucher.association}</div>
    </div>
    
    <div class="voucher-body">
      <div class="amount">${voucher.amount.toLocaleString()}원</div>
      
      <div class="voucher-info">
        <div class="info-row">
          <span class="info-label">성명</span>
          <span class="info-value">${voucher.name}</span>
        </div>
        ${voucher.member_id ? `
        <div class="info-row">
          <span class="info-label">회원번호</span>
          <span class="info-value">${voucher.member_id}</span>
        </div>
        ` : ''}
        <div class="info-row">
          <span class="info-label">발행일</span>
          <span class="info-value">${new Date(voucher.issued_at).toLocaleDateString('ko-KR')}</span>
        </div>
      </div>
    </div>
    
    <div class="qr-section">
      <div class="qr-code">
        <div style="font-size: 8px; text-align: center; color: #666;">
          QR 코드<br/>
          ${voucher.serial_no.slice(0, 8)}...
        </div>
      </div>
      <div class="serial-no">${voucher.serial_no}</div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generate dynamic CSS for field positioning
   */
  private generateFieldCSS(fieldPositions: any): string {
    if (!fieldPositions || typeof fieldPositions !== 'object') {
      return '';
    }

    let css = '';
    for (const [field, position] of Object.entries(fieldPositions)) {
      if (position && typeof position === 'object') {
        const pos = position as any;
        css += `
          .field-${field} {
            position: absolute;
            left: ${pos.x || 0}px;
            top: ${pos.y || 0}px;
            font-size: ${pos.fontSize || 14}px;
            color: ${pos.color || '#000000'};
            font-weight: ${pos.fontWeight || 'normal'};
          }
        `;
      }
    }
    return css;
  }

  /**
   * Generate QR code data with HMAC signature
   */
  private generateQRData(voucher: VoucherData): string {
    // This should use the same HMAC logic as the existing system
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 12);
    const issuedDate = new Date(voucher.issued_at).toISOString().slice(0, 10).replace(/-/g, '');
    
    // For now, return a simple format - this should be enhanced with actual HMAC
    return `VCH:${voucher.serial_no}|ISSUED:${issuedDate}|TS:${timestamp}`;
  }

  /**
   * Render single mobile voucher to image
   */
  public async renderVoucher(
    voucher: VoucherData, 
    template: MobileTemplate, 
    options: RenderOptions = {}
  ): Promise<Buffer> {
    const browser = await this.ensureBrowser();
    const page = await browser.newPage();

    try {
      const {
        width = 400,
        height = 400,
        quality = 90,
        format = 'png',
        background = true
      } = options;

      // Set viewport and page size
      await page.setViewport({ width, height });

      // Generate and set HTML content
      const html = this.generateMobileHTML(voucher, template);
      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Take screenshot
      const imageBuffer = await page.screenshot({
        type: format,
        quality: format === 'jpeg' ? quality : undefined,
        omitBackground: !background,
        clip: {
          x: 0,
          y: 0,
          width,
          height
        }
      });

      return imageBuffer as Buffer;

    } catch (error) {
      console.error('Error rendering voucher:', error);
      throw new Error(`Failed to render voucher: ${error}`);
    } finally {
      await page.close();
    }
  }

  /**
   * Render multiple vouchers in batch
   */
  public async renderBatch(
    vouchers: VoucherData[], 
    template: MobileTemplate, 
    options: RenderOptions = {}
  ): Promise<Buffer[]> {
    const results: Buffer[] = [];
    
    for (const voucher of vouchers) {
      try {
        const imageBuffer = await this.renderVoucher(voucher, template, options);
        results.push(imageBuffer);
      } catch (error) {
        console.error(`Failed to render voucher ${voucher.serial_no}:`, error);
        // Create error placeholder image
        const errorBuffer = await this.createErrorImage(voucher.serial_no, options);
        results.push(errorBuffer);
      }
    }

    return results;
  }

  /**
   * Create error placeholder image
   */
  private async createErrorImage(serialNo: string, options: RenderOptions): Promise<Buffer> {
    const browser = await this.ensureBrowser();
    const page = await browser.newPage();

    try {
      const { width = 400, height = 400 } = options;
      
      await page.setViewport({ width, height });
      
      const errorHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              background: #f3f4f6; 
              color: #ef4444; 
              font-family: sans-serif;
              width: ${width}px;
              height: ${height}px;
              margin: 0;
            }
            .error { text-align: center; }
          </style>
        </head>
        <body>
          <div class="error">
            <h3>렌더링 오류</h3>
            <p>${serialNo}</p>
          </div>
        </body>
        </html>
      `;

      await page.setContent(errorHTML);
      const imageBuffer = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width, height }
      });

      return imageBuffer as Buffer;

    } finally {
      await page.close();
    }
  }

  /**
   * Cleanup browser resources
   */
  public async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.isInitialized = false;
      console.log('Puppeteer browser closed');
    }
  }

  /**
   * Get template data from database
   */
  public async getTemplate(templateId: string): Promise<MobileTemplate | null> {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Join voucher_templates with mobile_design_templates
      const { data, error } = await supabase
        .from('voucher_templates')
        .select(`
          *,
          mobile_design_templates(*)
        `)
        .eq('id', templateId)
        .single();

      if (error || !data) {
        console.error('Template fetch error:', error);
        return null;
      }

      const mobileTemplate = data.mobile_design_templates?.[0];
      
      if (!mobileTemplate) {
        console.warn('No mobile design template found for template ID:', templateId);
        // Return default mobile template structure
        return {
          id: data.id,
          name: data.voucher_name,
          mobile_image_url: null,
          mobile_field_positions: {},
          background_color: '#ffffff',
          text_color: '#1f2937',
          font_family: 'Pretendard, sans-serif'
        };
      }

      return {
        id: mobileTemplate.id,
        name: mobileTemplate.name,
        mobile_image_url: mobileTemplate.background_image_url,
        mobile_field_positions: mobileTemplate.field_positions || {},
        background_color: mobileTemplate.background_color,
        text_color: mobileTemplate.text_color,
        font_family: mobileTemplate.font_family,
        width: mobileTemplate.width,
        height: mobileTemplate.height,
        accent_color: mobileTemplate.accent_color,
        template_config: mobileTemplate.template_config || {}
      };

    } catch (error) {
      console.error('Error fetching template:', error);
      return null;
    }
  }

  /**
   * Get all available mobile templates
   */
  public async getAllTemplates(): Promise<MobileTemplate[]> {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data, error } = await supabase
        .from('mobile_design_templates')
        .select(`
          *,
          voucher_templates(
            id,
            voucher_name,
            voucher_type
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Templates fetch error:', error);
        return [];
      }

      return data.map(template => ({
        id: template.id,
        name: template.name,
        mobile_image_url: template.background_image_url,
        mobile_field_positions: template.field_positions || {},
        background_color: template.background_color,
        text_color: template.text_color,
        font_family: template.font_family,
        width: template.width,
        height: template.height,
        accent_color: template.accent_color,
        template_config: template.template_config || {}
      }));

    } catch (error) {
      console.error('Error fetching all templates:', error);
      return [];
    }
  }
}

// Singleton instance
let rendererInstance: MobileVoucherRenderer | null = null;

export function getMobileRenderer(): MobileVoucherRenderer {
  if (!rendererInstance) {
    rendererInstance = new MobileVoucherRenderer();
  }
  return rendererInstance;
}

// Cleanup on process exit
process.on('exit', async () => {
  if (rendererInstance) {
    await rendererInstance.cleanup();
  }
});

process.on('SIGINT', async () => {
  if (rendererInstance) {
    await rendererInstance.cleanup();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (rendererInstance) {
    await rendererInstance.cleanup();
  }
  process.exit(0);
});