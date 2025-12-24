// 권한 관리 시스템
export interface UserRole {
  role: 'admin' | 'staff';
  permissions: string[];
  site_id: string;
}

export interface JWTPayload {
  sub: string;        // 사용자 ID
  name: string;       // 사용자 이름
  role: string;       // 역할 (admin/staff)
  site_id: string;    // 사업장 ID
  phone?: string;     // 휴대폰 번호 (선택적)
  iat: number;        // 발급 시간
  exp: number;        // 만료 시간
}

export interface Permission {
  resource: string;   // 리소스 (user, voucher, site, audit)
  action: string;     // 액션 (read, write, delete, use)
}

// 권한 상수 정의
export const PERMISSIONS = {
  // 사용자 관리 권한
  USER_READ: 'user:read',
  USER_WRITE: 'user:write',
  USER_DELETE: 'user:delete',
  
  // 교환권 관리 권한
  VOUCHER_READ: 'voucher:read',
  VOUCHER_WRITE: 'voucher:write',
  VOUCHER_DELETE: 'voucher:delete',
  VOUCHER_USE: 'voucher:use',
  
  // 사업장 관리 권한
  SITE_READ: 'site:read',
  SITE_WRITE: 'site:write',
  SITE_DELETE: 'site:delete',
  
  // 감사 로그 권한
  AUDIT_READ: 'audit:read',
  AUDIT_WRITE: 'audit:write',
  
  // 스캔 권한
  SCAN_READ: 'scan:read',
  SCAN_WRITE: 'scan:write',
} as const;

// 역할별 권한 매핑
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_WRITE,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.VOUCHER_READ,
    PERMISSIONS.VOUCHER_WRITE,
    PERMISSIONS.VOUCHER_DELETE,
    PERMISSIONS.VOUCHER_USE,
    PERMISSIONS.SITE_READ,
    PERMISSIONS.SITE_WRITE,
    PERMISSIONS.SITE_DELETE,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.AUDIT_WRITE,
    PERMISSIONS.SCAN_READ,
    PERMISSIONS.SCAN_WRITE,
  ],
  staff: [
    PERMISSIONS.VOUCHER_READ,
    PERMISSIONS.VOUCHER_USE,
    PERMISSIONS.SCAN_READ,
    PERMISSIONS.SCAN_WRITE,
  ],
};

// 권한 검사 함수
export function hasPermission(userRole: string, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission);
}

// 여러 권한 중 하나라도 있는지 검사
export function hasAnyPermission(userRole: string, permissions: string[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

// 모든 권한이 있는지 검사
export function hasAllPermissions(userRole: string, permissions: string[]): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}

// 역할이 admin인지 검사
export function isAdmin(userRole: string): boolean {
  return userRole === 'admin';
}

// 역할이 staff인지 검사
export function isStaff(userRole: string): boolean {
  return userRole === 'staff';
}

// 권한 검사 데코레이터 (API 라우트용)
export function requirePermission(permission: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      // 권한 검사 로직 (실제 구현 시 JWT 토큰에서 사용자 역할 추출)
      const userRole = 'admin'; // 임시로 admin으로 설정
      
      if (!hasPermission(userRole, permission)) {
        throw new Error(`권한이 없습니다: ${permission}`);
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

// 권한 검사 미들웨어 (Next.js API 라우트용)
export function withPermission(permission: string) {
  return function(handler: Function) {
    return async function(req: any, res: any) {
      try {
        // JWT 토큰에서 사용자 정보 추출 (실제 구현 시)
        const userRole = 'admin'; // 임시로 admin으로 설정
        
        if (!hasPermission(userRole, permission)) {
          return res.status(403).json({
            success: false,
            error: 'FORBIDDEN',
            message: `권한이 없습니다: ${permission}`
          });
        }
        
        return handler(req, res);
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: '권한 검사 중 오류가 발생했습니다.'
        });
      }
    };
  };
}

// 사용자 권한 정보 생성
export function createUserPermissions(userRole: string, siteId: string): UserRole {
  return {
    role: userRole as 'admin' | 'staff',
    permissions: ROLE_PERMISSIONS[userRole] || [],
    site_id: siteId,
  };
}

// 권한 검사 결과 객체
export interface PermissionCheckResult {
  hasPermission: boolean;
  userRole: string;
  requiredPermission: string;
  userPermissions: string[];
  message: string;
}

// 상세 권한 검사 함수
export function checkPermission(
  userRole: string, 
  permission: string, 
  siteId?: string
): PermissionCheckResult {
  const hasAccess = hasPermission(userRole, permission);
  const userPermissions = ROLE_PERMISSIONS[userRole] || [];
  
  return {
    hasPermission: hasAccess,
    userRole,
    requiredPermission: permission,
    userPermissions,
    message: hasAccess 
      ? '권한이 있습니다.' 
      : `권한이 없습니다. 필요한 권한: ${permission}`,
  };
}
