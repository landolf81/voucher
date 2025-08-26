/**
 * Secure Link Generator for Mobile Voucher Access
 * Generates cryptographically secure tokens for mobile voucher batch access
 */

import crypto from 'crypto';
import { getBaseUrl } from './url-utils';

export interface LinkOptions {
  expiresInHours?: number;
  length?: number;
  includeTimestamp?: boolean;
}

export interface GeneratedLink {
  token: string;
  url: string;
  expiresAt: Date;
}

export class LinkGenerator {
  private readonly baseUrl: string;
  private readonly defaultExpiryHours: number;
  private readonly defaultTokenLength: number;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getBaseUrl();
    this.defaultExpiryHours = 24; // 24 hours default
    this.defaultTokenLength = 32;
  }

  /**
   * Generate a cryptographically secure random token
   */
  public generateSecureToken(length: number = this.defaultTokenLength): string {
    // Use crypto.randomBytes for cryptographically secure random generation
    const bytes = crypto.randomBytes(Math.ceil(length * 3 / 4));
    return bytes
      .toString('base64')
      .replace(/[+/=]/g, '') // Remove special characters
      .slice(0, length);
  }

  /**
   * Generate a secure link for mobile voucher batch access
   */
  public generateMobileLink(
    batchId: string,
    userId: string,
    options: LinkOptions = {}
  ): GeneratedLink {
    const {
      expiresInHours = this.defaultExpiryHours,
      length = this.defaultTokenLength,
      includeTimestamp = true
    } = options;

    // Generate base token
    let token = this.generateSecureToken(length);

    // Optionally include timestamp for additional entropy
    if (includeTimestamp) {
      const timestamp = Date.now().toString(36);
      token = `${token}_${timestamp}`;
    }

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // Generate full URL
    const url = `${this.baseUrl}/mobile/vouchers/${token}`;

    return {
      token,
      url,
      expiresAt
    };
  }

  /**
   * Validate token format (basic validation)
   */
  public isValidTokenFormat(token: string): boolean {
    // Check if token matches expected format
    const tokenRegex = /^[A-Za-z0-9_-]+$/;
    return tokenRegex.test(token) && token.length >= 16 && token.length <= 64;
  }

  /**
   * Extract timestamp from token (if included)
   */
  public extractTimestamp(token: string): Date | null {
    try {
      const parts = token.split('_');
      if (parts.length >= 2) {
        const timestampStr = parts[parts.length - 1];
        const timestamp = parseInt(timestampStr, 36);
        if (!isNaN(timestamp)) {
          return new Date(timestamp);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Generate sharing text for mobile links
   */
  public generateSharingText(
    batchName: string,
    voucherCount: number,
    expiresAt: Date
  ): string {
    const expiryText = expiresAt.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `🎫 교환권이 발행되었습니다\n\n` +
           `📋 배치명: ${batchName}\n` +
           `📊 수량: ${voucherCount}개\n` +
           `⏰ 만료: ${expiryText}\n\n` +
           `아래 링크에서 교환권을 다운로드하세요:`;
  }

  /**
   * Generate QR code data for sharing links
   */
  public generateQRData(url: string, metadata?: any): string {
    const qrData = {
      url,
      type: 'mobile_voucher_batch',
      generated_at: new Date().toISOString(),
      ...metadata
    };

    return JSON.stringify(qrData);
  }

  /**
   * Create short link (for future implementation with URL shortener)
   */
  public async createShortLink(originalUrl: string): Promise<string> {
    // For now, return original URL
    // In future, integrate with URL shortening service
    return originalUrl;
  }

  /**
   * Generate email template for link sharing
   */
  public generateEmailTemplate(
    recipientName: string,
    batchName: string,
    voucherCount: number,
    url: string,
    expiresAt: Date
  ): { subject: string; html: string; text: string } {
    const expiryText = expiresAt.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const subject = `[교환권 시스템] ${batchName} - ${voucherCount}개 교환권 발행 완료`;

    const text = `
안녕하세요, ${recipientName}님

요청하신 교환권이 발행되었습니다.

배치명: ${batchName}
수량: ${voucherCount}개
만료일: ${expiryText}

다음 링크에서 교환권을 다운로드하실 수 있습니다:
${url}

※ 이 링크는 ${expiryText}까지 유효합니다.
※ 교환권은 개별 다운로드 또는 일괄 다운로드가 가능합니다.

감사합니다.
교환권 관리 시스템
    `;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #007bff; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 20px; }
    .voucher-info { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
    .download-button { 
      display: inline-block; 
      background: #28a745; 
      color: white; 
      padding: 15px 30px; 
      text-decoration: none; 
      border-radius: 5px; 
      font-weight: bold;
      margin: 20px 0;
    }
    .footer { background: #6c757d; color: white; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; }
    .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎫 교환권 발행 완료</h1>
    </div>
    
    <div class="content">
      <p>안녕하세요, <strong>${recipientName}</strong>님</p>
      
      <p>요청하신 교환권이 성공적으로 발행되었습니다.</p>
      
      <div class="voucher-info">
        <h3>📋 발행 정보</h3>
        <ul>
          <li><strong>배치명:</strong> ${batchName}</li>
          <li><strong>수량:</strong> ${voucherCount}개</li>
          <li><strong>만료일:</strong> ${expiryText}</li>
        </ul>
      </div>
      
      <div style="text-align: center;">
        <a href="${url}" class="download-button">📱 교환권 다운로드</a>
      </div>
      
      <div class="warning">
        <strong>⚠️ 유의사항</strong>
        <ul>
          <li>이 링크는 ${expiryText}까지 유효합니다.</li>
          <li>교환권은 개별 또는 일괄 다운로드가 가능합니다.</li>
          <li>링크를 다른 사람과 공유하지 마세요.</li>
        </ul>
      </div>
    </div>
    
    <div class="footer">
      <p>이 메일은 교환권 관리 시스템에서 자동으로 발송되었습니다.</p>
      <p>문의사항이 있으시면 관리자에게 연락해주세요.</p>
    </div>
  </div>
</body>
</html>
    `;

    return { subject, html, text };
  }
}

// Utility functions for common operations
export function generateMobileVoucherLink(
  batchId: string,
  userId: string,
  options?: LinkOptions
): GeneratedLink {
  const generator = new LinkGenerator();
  return generator.generateMobileLink(batchId, userId, options);
}

export function validateVoucherToken(token: string): boolean {
  const generator = new LinkGenerator();
  return generator.isValidTokenFormat(token);
}

export function createSharingText(
  batchName: string,
  voucherCount: number,
  expiresAt: Date
): string {
  const generator = new LinkGenerator();
  return generator.generateSharingText(batchName, voucherCount, expiresAt);
}

// Export singleton instance
export const linkGenerator = new LinkGenerator();