import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT, extractTokenFromRequest } from './jwt';
import { hasPermission, PERMISSIONS } from './auth';
import { JWTPayload } from './auth';

// 권한 검사와 JWT 검증을 통합한 미들웨어
export function withAuthAndPermission(permission: string) {
  return function(handler: Function) {
    return async function(req: NextRequest, res: NextResponse) {
      try {
        // JWT 토큰 추출
        const token = extractTokenFromRequest(req);
        
        if (!token) {
          return NextResponse.json({
            success: false,
            error: 'UNAUTHORIZED',
            message: 'JWT 토큰이 필요합니다.'
          }, { status: 401 });
        }
        
        // JWT 토큰 검증
        const payload = verifyJWT(token);
        if (!payload) {
          return NextResponse.json({
            success: false,
            error: 'INVALID_TOKEN',
            message: '유효하지 않은 JWT 토큰입니다.'
          }, { status: 401 });
        }
        
        // 권한 검사
        if (!hasPermission(payload.role, permission)) {
          return NextResponse.json({
            success: false,
            error: 'FORBIDDEN',
            message: `권한이 없습니다: ${permission}`,
            requiredPermission: permission,
            userRole: payload.role
          }, { status: 403 });
        }
        
        // 요청 객체에 사용자 정보 추가
        (req as any).user = payload;
        
        return handler(req, res);
      } catch (error) {
        console.error('권한 검사 미들웨어 오류:', error);
        return NextResponse.json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: '권한 검사 중 오류가 발생했습니다.'
        }, { status: 500 });
      }
    };
  };
}

// 관리자 권한만 허용하는 미들웨어
export function withAdminOnly(handler: Function) {
  return withAuthAndPermission(PERMISSIONS.USER_READ)(handler);
}

// 스캔 권한만 허용하는 미들웨어
export function withScanPermission(handler: Function) {
  return withAuthAndPermission(PERMISSIONS.SCAN_READ)(handler);
}

// 교환권 사용 권한만 허용하는 미들웨어
export function withVoucherUsePermission(handler: Function) {
  return withAuthAndPermission(PERMISSIONS.VOUCHER_USE)(handler);
}

// 교환권 읽기 권한만 허용하는 미들웨어
export function withVoucherReadPermission(handler: Function) {
  return withAuthAndPermission(PERMISSIONS.VOUCHER_READ)(handler);
}

// 사업장별 접근 제어 미들웨어
export function withSiteAccess(handler: Function) {
  return withAuthAndPermission(PERMISSIONS.SITE_READ)(handler);
}

// 감사 로그 접근 권한 미들웨어
export function withAuditPermission(handler: Function) {
  return withAuthAndPermission(PERMISSIONS.AUDIT_READ)(handler);
}

// 복합 권한 검사 미들웨어 (여러 권한 중 하나라도 있으면 허용)
export function withAnyPermission(permissions: string[]) {
  return function(handler: Function) {
    return async function(req: NextRequest, res: NextResponse) {
      try {
        // JWT 토큰 추출
        const token = extractTokenFromRequest(req);
        
        if (!token) {
          return NextResponse.json({
            success: false,
            error: 'UNAUTHORIZED',
            message: 'JWT 토큰이 필요합니다.'
          }, { status: 401 });
        }
        
        // JWT 토큰 검증
        const payload = verifyJWT(token);
        if (!payload) {
          return NextResponse.json({
            success: false,
            error: 'INVALID_TOKEN',
            message: '유효하지 않은 JWT 토큰입니다.'
          }, { status: 401 });
        }
        
        // 여러 권한 중 하나라도 있는지 검사
        const hasAnyAccess = permissions.some(permission => 
          hasPermission(payload.role, permission)
        );
        
        if (!hasAnyAccess) {
          return NextResponse.json({
            success: false,
            error: 'FORBIDDEN',
            message: `필요한 권한이 없습니다: ${permissions.join(', ')}`,
            requiredPermissions: permissions,
            userRole: payload.role
          }, { status: 403 });
        }
        
        // 요청 객체에 사용자 정보 추가
        (req as any).user = payload;
        
        return handler(req, res);
      } catch (error) {
        console.error('복합 권한 검사 미들웨어 오류:', error);
        return NextResponse.json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: '권한 검사 중 오류가 발생했습니다.'
        }, { status: 500 });
      }
    };
  };
}

// 모든 권한이 있어야 하는 미들웨어
export function withAllPermissions(permissions: string[]) {
  return function(handler: Function) {
    return async function(req: NextRequest, res: NextResponse) {
      try {
        // JWT 토큰 추출
        const token = extractTokenFromRequest(req);
        
        if (!token) {
          return NextResponse.json({
            success: false,
            error: 'UNAUTHORIZED',
            message: 'JWT 토큰이 필요합니다.'
          }, { status: 401 });
        }
        
        // JWT 토큰 검증
        const payload = verifyJWT(token);
        if (!payload) {
          return NextResponse.json({
            success: false,
            error: 'INVALID_TOKEN',
            message: '유효하지 않은 JWT 토큰입니다.'
          }, { status: 401 });
        }
        
        // 모든 권한이 있는지 검사
        const hasAllAccess = permissions.every(permission => 
          hasPermission(payload.role, permission)
        );
        
        if (!hasAllAccess) {
          return NextResponse.json({
            success: false,
            error: 'FORBIDDEN',
            message: `모든 권한이 필요합니다: ${permissions.join(', ')}`,
            requiredPermissions: permissions,
            userRole: payload.role
          }, { status: 403 });
        }
        
        // 요청 객체에 사용자 정보 추가
        (req as any).user = payload;
        
        return handler(req, res);
      } catch (error) {
        console.error('전체 권한 검사 미들웨어 오류:', error);
        return NextResponse.json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: '권한 검사 중 오류가 발생했습니다.'
        }, { status: 500 });
      }
    };
  };
}

// 사용자 역할별 접근 제어 미들웨어
export function withRoleAccess(allowedRoles: string[]) {
  return function(handler: Function) {
    return async function(req: NextRequest, res: NextResponse) {
      try {
        // JWT 토큰 추출
        const token = extractTokenFromRequest(req);
        
        if (!token) {
          return NextResponse.json({
            success: false,
            error: 'UNAUTHORIZED',
            message: 'JWT 토큰이 필요합니다.'
          }, { status: 401 });
        }
        
        // JWT 토큰 검증
        const payload = verifyJWT(token);
        if (!payload) {
          return NextResponse.json({
            success: false,
            error: 'INVALID_TOKEN',
            message: '유효하지 않은 JWT 토큰입니다.'
          }, { status: 401 });
        }
        
        // 역할 검사
        if (!allowedRoles.includes(payload.role)) {
          return NextResponse.json({
            success: false,
            error: 'FORBIDDEN',
            message: `허용되지 않은 역할입니다: ${payload.role}`,
            allowedRoles: allowedRoles,
            userRole: payload.role
          }, { status: 403 });
        }
        
        // 요청 객체에 사용자 정보 추가
        (req as any).user = payload;
        
        return handler(req, res);
      } catch (error) {
        console.error('역할 기반 접근 제어 미들웨어 오류:', error);
        return NextResponse.json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: '역할 검사 중 오류가 발생했습니다.'
        }, { status: 500 });
      }
    };
  };
}

// 관리자만 접근 가능한 미들웨어
export function withAdminRole(handler: Function) {
  return withRoleAccess(['admin'])(handler);
}

// 직원만 접근 가능한 미들웨어
export function withStaffRole(handler: Function) {
  return withRoleAccess(['staff'])(handler);
}

// 관리자 또는 직원 모두 접근 가능한 미들웨어
export function withAnyRole(handler: Function) {
  return withRoleAccess(['admin', 'staff'])(handler);
}

// 사업장별 데이터 접근 제어 미들웨어
export function withSiteDataAccess(handler: Function) {
  return async function(req: NextRequest, res: NextResponse) {
    try {
      // 먼저 기본 인증 및 권한 검사
      const authMiddleware = withAuthAndPermission(PERMISSIONS.SITE_READ);
      const authHandler = authMiddleware(handler);
      
      // 사업장 ID 추출 (URL 파라미터, 쿼리에서)
      const url = new URL(req.url);
      const siteId = url.searchParams.get('site_id') || 
                    url.pathname.split('/').pop();
      
      if (!siteId) {
        return NextResponse.json({
          success: false,
          error: 'BAD_REQUEST',
          message: '사업장 ID가 필요합니다.'
        }, { status: 400 });
      }
      
      // 사용자 정보에서 사업장 ID 확인
      const user = (req as any).user as JWTPayload;
      if (user.site_id !== siteId && user.role !== 'admin') {
        return NextResponse.json({
          success: false,
          error: 'FORBIDDEN',
          message: '다른 사업장의 데이터에 접근할 수 없습니다.',
          userSiteId: user.site_id,
          requestedSiteId: siteId
        }, { status: 403 });
      }
      
      return authHandler(req, res);
    } catch (error) {
      console.error('사업장별 데이터 접근 제어 미들웨어 오류:', error);
      return NextResponse.json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: '사업장별 접근 제어 중 오류가 발생했습니다.'
      }, { status: 500 });
    }
  };
}
