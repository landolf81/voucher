/**
 * 간단한 암호화/복호화 유틸리티
 * 실제 프로덕션에서는 crypto-js 같은 라이브러리 사용 권장
 */

// Base64 인코딩/디코딩을 사용한 간단한 암호화 (개발용)
// 실제로는 AES 등의 강력한 암호화 사용 필요

/**
 * 전화번호 암호화
 */
export function encryptPhone(phone: string): string {
  if (!phone) return '';
  
  // 개발 환경용 간단한 암호화 (Base64 + 문자 치환)
  const shifted = phone
    .split('')
    .map(char => String.fromCharCode(char.charCodeAt(0) + 3))
    .join('');
  
  return Buffer.from(shifted).toString('base64');
}

/**
 * 전화번호 복호화
 */
export function decryptPhone(encryptedPhone: string): string {
  if (!encryptedPhone) return '';
  
  try {
    // Base64 디코딩 후 문자 복원
    const shifted = Buffer.from(encryptedPhone, 'base64').toString();
    
    return shifted
      .split('')
      .map(char => String.fromCharCode(char.charCodeAt(0) - 3))
      .join('');
  } catch (error) {
    console.error('전화번호 복호화 실패:', error);
    return '';
  }
}

/**
 * 전화번호 마스킹 (표시용)
 * 010-****-5678 형태로 변환
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 11) return phone;
  
  const cleaned = phone.replace(/[^0-9]/g, '');
  return `${cleaned.slice(0, 3)}-****-${cleaned.slice(-4)}`;
}

/**
 * 권한 레벨 체크
 */
export function hasPermission(userRole: 'admin' | 'staff' | 'viewer', requiredRole: 'admin' | 'staff' | 'viewer'): boolean {
  const roleLevel = {
    'viewer': 1,  // 조회만 가능
    'staff': 2,   // 사업장 관리 가능
    'admin': 3    // 전체 관리 가능
  };
  
  return roleLevel[userRole] >= roleLevel[requiredRole];
}

/**
 * 권한별 접근 가능 메뉴
 */
export const ROLE_PERMISSIONS = {
  viewer: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canManageUsers: false,
    canManageVouchers: false,
    canPrint: false,
    canExport: false,
    menuAccess: ['overview', 'vouchers'] // 조회 메뉴만
  },
  staff: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canManageUsers: false,
    canManageVouchers: true,
    canPrint: true,
    canExport: true,
    menuAccess: ['overview', 'vouchers'] // 교환권 관리 가능
  },
  admin: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canManageUsers: true,
    canManageVouchers: true,
    canPrint: true,
    canExport: true,
    menuAccess: ['overview', 'vouchers', 'users'] // 모든 메뉴 접근
  }
};

/**
 * 권한 이름 한글 변환
 */
export function getRoleName(role: 'admin' | 'staff' | 'viewer'): string {
  const roleNames = {
    'admin': '관리자',
    'staff': '직원',
    'viewer': '조회자'
  };
  
  return roleNames[role] || role;
}

/**
 * 권한별 색상
 */
export function getRoleColor(role: 'admin' | 'staff' | 'viewer'): { bg: string; text: string } {
  const colors = {
    'admin': { bg: '#fef2f2', text: '#dc2626' },  // 빨간색
    'staff': { bg: '#fef3c7', text: '#d97706' },  // 주황색
    'viewer': { bg: '#f0fdf4', text: '#166534' }  // 초록색
  };
  
  return colors[role] || { bg: '#f3f4f6', text: '#374151' };
}