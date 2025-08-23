import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

export interface VoucherData {
  serial_no: string;
  amount: number;
  association: string;
  member_id: string;
  name: string;
  dob?: string;
  site_id: string;
  hmac?: string;
}

/**
 * QR코드 데이터 생성 (보안 검증용 HMAC 포함)
 */
export function generateQRCodeData(voucherData: VoucherData): string {
  const qrData = {
    serial: voucherData.serial_no,
    amount: voucherData.amount,
    site: voucherData.site_id,
    member: voucherData.member_id,
    // HMAC 서명으로 변조 방지
    hmac: voucherData.hmac || generateVoucherHMAC(voucherData)
  };
  
  return JSON.stringify(qrData);
}

/**
 * QR코드 SVG 생성
 */
export async function generateQRCodeSVG(voucherData: VoucherData, options?: {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}): Promise<string> {
  const qrData = generateQRCodeData(voucherData);
  
  const qrOptions = {
    type: 'svg' as const,
    width: options?.width || 200,
    margin: options?.margin || 2,
    color: {
      dark: options?.color?.dark || '#000000',
      light: options?.color?.light || '#FFFFFF'
    },
    errorCorrectionLevel: 'M' as const
  };
  
  try {
    return await QRCode.toString(qrData, qrOptions);
  } catch (error) {
    console.error('QR Code generation failed:', error);
    throw new Error('QR코드 생성에 실패했습니다.');
  }
}

/**
 * QR코드 Data URL 생성 (PNG)
 */
export async function generateQRCodeDataURL(voucherData: VoucherData, options?: {
  width?: number;
  margin?: number;
}): Promise<string> {
  const qrData = generateQRCodeData(voucherData);
  
  const qrOptions = {
    width: options?.width || 200,
    margin: options?.margin || 2,
    errorCorrectionLevel: 'M' as const
  };
  
  try {
    return await QRCode.toDataURL(qrData, qrOptions);
  } catch (error) {
    console.error('QR Code generation failed:', error);
    throw new Error('QR코드 생성에 실패했습니다.');
  }
}

/**
 * 바코드 SVG 생성 (CODE128 형식)
 */
export function generateBarcodeSVG(serialNo: string, options?: {
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
}): string {
  // 브라우저에서 Canvas 생성
  const canvas = document.createElement('canvas');
  canvas.width = options?.width || 300;
  canvas.height = options?.height || 100;
  
  try {
    JsBarcode(canvas, serialNo, {
      format: 'CODE128',
      width: 2,
      height: options?.height || 100,
      displayValue: options?.displayValue !== false,
      fontSize: options?.fontSize || 14,
      textAlign: 'center',
      textPosition: 'bottom',
      background: '#FFFFFF',
      lineColor: '#000000'
    });
    
    // Canvas를 SVG로 변환 (임시 구현)
    const dataUrl = canvas.toDataURL();
    const svgString = `
      <svg width="${options?.width || 300}" height="${options?.height || 100}" xmlns="http://www.w3.org/2000/svg">
        <image href="${dataUrl}" width="100%" height="100%"/>
      </svg>
    `;
    
    return svgString;
  } catch (error) {
    console.error('Barcode generation failed:', error);
    // 대체 SVG 반환
    return `
      <svg width="${options?.width || 300}" height="${options?.height || 100}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f8f9fa" stroke="#dee2e6" stroke-width="1"/>
        <text x="50%" y="50%" text-anchor="middle" font-family="monospace" font-size="14px" fill="#6c757d">${serialNo}</text>
      </svg>
    `;
  }
}

/**
 * 바코드 Data URL 생성 (PNG)
 */
export function generateBarcodeDataURL(serialNo: string, options?: {
  width?: number;
  height?: number;
  displayValue?: boolean;
}): string {
  const canvas = document.createElement('canvas');
  canvas.width = options?.width || 300;
  canvas.height = options?.height || 100;
  
  try {
    JsBarcode(canvas, serialNo, {
      format: 'CODE128',
      width: 2,
      height: options?.height || 100,
      displayValue: options?.displayValue !== false,
      fontSize: 14,
      textAlign: 'center',
      textPosition: 'bottom',
      background: '#FFFFFF',
      lineColor: '#000000'
    });
    
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Barcode generation failed:', error);
    throw new Error('바코드 생성에 실패했습니다.');
  }
}

/**
 * 교환권 HMAC 서명 생성 (보안 검증용)
 */
function generateVoucherHMAC(voucherData: VoucherData): string {
  const crypto = require('crypto');
  const secret = process.env.VOUCHER_HMAC_SECRET || 'default-secret';
  
  const dataString = `${voucherData.serial_no}:${voucherData.amount}:${voucherData.site_id}:${voucherData.member_id}`;
  
  return crypto
    .createHmac('sha256', secret)
    .update(dataString)
    .digest('hex');
}

/**
 * 교환권 HMAC 검증
 */
export function verifyVoucherHMAC(voucherData: VoucherData, hmac: string): boolean {
  const expectedHmac = generateVoucherHMAC(voucherData);
  return expectedHmac === hmac;
}

/**
 * QR코드에서 교환권 데이터 파싱
 */
export function parseQRCodeData(qrCodeData: string): {
  serial: string;
  amount: number;
  site: string;
  member: string;
  hmac: string;
} | null {
  try {
    const data = JSON.parse(qrCodeData);
    
    if (!data.serial || !data.amount || !data.site || !data.member || !data.hmac) {
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('QR Code parsing failed:', error);
    return null;
  }
}

/**
 * 교환권 코드 생성 (QR + 바코드 통합)
 */
export async function generateVoucherCodes(voucherData: VoucherData, format: 'svg' | 'dataurl' = 'svg') {
  const hmac = generateVoucherHMAC(voucherData);
  const dataWithHmac = { ...voucherData, hmac };
  
  if (format === 'svg') {
    const [qrCode, barcode] = await Promise.all([
      generateQRCodeSVG(dataWithHmac),
      Promise.resolve(generateBarcodeSVG(voucherData.serial_no))
    ]);
    
    return { qrCode, barcode, hmac };
  } else {
    const [qrCode, barcode] = await Promise.all([
      generateQRCodeDataURL(dataWithHmac),
      Promise.resolve(generateBarcodeDataURL(voucherData.serial_no))
    ]);
    
    return { qrCode, barcode, hmac };
  }
}