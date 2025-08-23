/**
 * 데이터 암호화/복호화 유틸리티
 * 개인정보 보호를 위한 AES 암호화 구현
 */

import crypto from 'crypto';

// 암호화 설정
const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = process.env.ENCRYPTION_SECRET || 'your-secret-encryption-key-32-chars!!';
const IV_LENGTH = 16; // For GCM, this is the IV length

// 키를 32바이트로 정규화
function getKey(): Buffer {
  return crypto.createHash('sha256').update(SECRET_KEY).digest();
}

/**
 * 문자열 암호화
 */
export function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('암호화 오류:', error);
    throw new Error('데이터 암호화에 실패했습니다.');
  }
}

/**
 * 문자열 복호화
 */
export function decrypt(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      // 기존 형식 지원 (backward compatibility)
      if (parts.length === 2) {
        return decryptLegacy(encryptedText);
      }
      throw new Error('잘못된 암호화 형식');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = getKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('복호화 오류:', error);
    throw new Error('데이터 복호화에 실패했습니다.');
  }
}

/**
 * 레거시 암호화 형식 복호화 (하위 호환성)
 */
function decryptLegacy(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('잘못된 레거시 암호화 형식');
    }
    
    const [ivHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const key = getKey();
    
    // 레거시 데이터를 위한 AES-256-CBC 사용 (IV 포함)
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('레거시 복호화 오류:', error);
    // 레거시 데이터가 아예 다른 형식일 경우 원본 반환
    return encryptedText;
  }
}

/**
 * 개인정보 마스킹 (UI 표시용)
 */
export function maskPersonalInfo(data: string, type: 'phone' | 'name' | 'id'): string {
  if (!data) return '';
  
  switch (type) {
    case 'phone':
      // 010-****-5678
      if (data.length >= 10) {
        return data.slice(0, 3) + '-****-' + data.slice(-4);
      }
      return '***-****-****';
      
    case 'name':
      // 김*동, 이**
      if (data.length === 2) {
        return data[0] + '*';
      } else if (data.length >= 3) {
        return data[0] + '*'.repeat(data.length - 2) + data.slice(-1);
      }
      return '*';
      
    case 'id':
      // test****
      if (data.length > 4) {
        return data.slice(0, 4) + '*'.repeat(data.length - 4);
      }
      return '****';
      
    default:
      return '****';
  }
}

/**
 * 사용자 데이터 암호화
 */
export interface EncryptedUser {
  id: string;
  user_id: string;
  encrypted_name: string;
  encrypted_phone: string;
  role: string;
  site_id: string;
  created_at?: string;
}

export function encryptUserData(userData: {
  name: string;
  phone: string;
  [key: string]: any;
}): { encrypted_name: string; encrypted_phone: string } {
  return {
    encrypted_name: encrypt(userData.name),
    encrypted_phone: encrypt(userData.phone)
  };
}

export function decryptUserData(encryptedData: {
  encrypted_name: string;
  encrypted_phone: string;
}): { name: string; phone: string } {
  return {
    name: decrypt(encryptedData.encrypted_name),
    phone: decrypt(encryptedData.encrypted_phone)
  };
}

/**
 * 교환권 데이터 암호화
 */
export interface EncryptedVoucher {
  id: string;
  serial_no: string;
  voucher_name: string; // 교환권 이름/제품명
  amount: number;
  member_id: string;
  farming_association: string;
  encrypted_name: string;
  encrypted_dob: string;
  encrypted_phone: string;
  voucher_type: 'fixed' | 'amount';
  status: string;
  issued_at: string;
  used_at?: string;
  expires_at?: string; // 유효기간
  usage_location?: string; // 사용처
  notes?: string;
}

export function encryptVoucherData(voucherData: {
  name: string;
  dob: string;
  phone: string;
  [key: string]: any;
}): { encrypted_name: string; encrypted_dob: string; encrypted_phone: string } {
  return {
    encrypted_name: safeEncrypt(voucherData.name),
    encrypted_dob: safeEncrypt(voucherData.dob),
    encrypted_phone: safeEncrypt(voucherData.phone)
  };
}

export function decryptVoucherData(encryptedData: {
  encrypted_name: string;
  encrypted_dob: string;
  encrypted_phone: string;
}): { name: string; dob: string; phone: string } {
  return {
    name: safeDecrypt(encryptedData.encrypted_name),
    dob: safeDecrypt(encryptedData.encrypted_dob),
    phone: safeDecrypt(encryptedData.encrypted_phone)
  };
}

/**
 * 개발 모드에서는 암호화 스킵 (옵션)
 */
export const isDevelopment = process.env.NODE_ENV === 'development';

export function safeEncrypt(text: string): string {
  if (isDevelopment && process.env.SKIP_ENCRYPTION === 'true') {
    return text;
  }
  return encrypt(text);
}

export function safeDecrypt(encryptedText: string): string {
  if (isDevelopment && process.env.SKIP_ENCRYPTION === 'true') {
    return encryptedText;
  }
  return decrypt(encryptedText);
}