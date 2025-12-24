/**
 * 권한 검사 미들웨어
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT, extractTokenFromRequest } from '@/lib/jwt';
import { hasPermission, Permission, UserRole } from './permissions';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    phone: string;
    name: string;
    role: UserRole;
    site_id: string;
  };
}

/**
 * JWT 토큰 검증 미들웨어
 */
export function withAuth(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return async function(req: NextRequest): Promise<NextResponse> {
    try {
      // Authorization 헤더에서 토큰 추출
      const authHeader = req.headers.get('authorization');
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
      
      // 쿠키에서 토큰 추출 (fallback)
      const cookieToken = req.cookies.get('jwt')?.value;
      
      const jwtToken = token || cookieToken;
      
      if (!jwtToken) {
        return NextResponse.json(
          {
            success: false,
            error: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
          },
          { status: 401 }
        );
      }

      // JWT 토큰 검증
      const payload = verifyJWT(jwtToken);
      if (!payload) {
        return NextResponse.json(
          {
            success: false,
            error: 'INVALID_TOKEN',
            message: '유효하지 않은 토큰입니다.',
          },
          { status: 401 }
        );
      }

      // 요청 객체에 사용자 정보 추가
      const authenticatedReq = req as AuthenticatedRequest;
      authenticatedReq.user = {
        id: payload.sub,
        phone: payload.phone,
        name: payload.name,
        role: payload.role as UserRole,
        site_id: payload.site_id,
      };

      return handler(authenticatedReq);
    } catch (error) {
      console.error('인증 미들웨어 오류:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'AUTH_ERROR',
          message: '인증 처리 중 오류가 발생했습니다.',
        },
        { status: 500 }
      );
    }
  };
}

/**
 * 권한 검사 미들웨어
 */
export function withPermission(
  permission: Permission,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(async function(req: AuthenticatedRequest): Promise<NextResponse> {
    const user = req.user!;
    
    if (!hasPermission(user.role, permission)) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN',
          message: `권한이 없습니다: ${permission}`,
        },
        { status: 403 }
      );
    }

    return handler(req);
  });
}

/**
 * 여러 권한 중 하나라도 있으면 허용하는 미들웨어
 */
export function withAnyPermission(
  permissions: Permission[],
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(async function(req: AuthenticatedRequest): Promise<NextResponse> {
    const user = req.user!;
    
    const hasAnyPermission = permissions.some(permission => 
      hasPermission(user.role, permission)
    );
    
    if (!hasAnyPermission) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN',
          message: `권한이 없습니다. 필요한 권한: ${permissions.join(', ')}`,
        },
        { status: 403 }
      );
    }

    return handler(req);
  });
}

/**
 * 관리자 전용 미들웨어
 */
export function withAdminOnly(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return withAuth(async function(req: AuthenticatedRequest): Promise<NextResponse> {
    const user = req.user!;
    
    if (user.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: 'ADMIN_REQUIRED',
          message: '관리자 권한이 필요합니다.',
        },
        { status: 403 }
      );
    }

    return handler(req);
  });
}

/**
 * 사업장별 접근 제어 미들웨어
 */
export function withSiteAccess(
  getSiteIdFromRequest: (req: AuthenticatedRequest) => string | null,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(async function(req: AuthenticatedRequest): Promise<NextResponse> {
    const user = req.user!;
    const requestedSiteId = getSiteIdFromRequest(req);
    
    // 관리자는 모든 사업장 접근 가능
    if (user.role === 'admin') {
      return handler(req);
    }
    
    // 일반 사용자는 자신의 사업장만 접근 가능
    if (requestedSiteId && requestedSiteId !== user.site_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'SITE_ACCESS_DENIED',
          message: '해당 사업장에 접근할 권한이 없습니다.',
        },
        { status: 403 }
      );
    }

    return handler(req);
  });
}

/**
 * 본인 확인 미들웨어 (자신의 데이터만 접근 가능)
 */
export function withSelfOnly(
  getUserIdFromRequest: (req: AuthenticatedRequest) => string | null,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(async function(req: AuthenticatedRequest): Promise<NextResponse> {
    const user = req.user!;
    const requestedUserId = getUserIdFromRequest(req);
    
    // 관리자는 모든 사용자 데이터 접근 가능
    if (user.role === 'admin') {
      return handler(req);
    }
    
    // 일반 사용자는 자신의 데이터만 접근 가능
    if (requestedUserId && requestedUserId !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'SELF_ACCESS_ONLY',
          message: '본인의 데이터만 접근할 수 있습니다.',
        },
        { status: 403 }
      );
    }

    return handler(req);
  });
}

/**
 * API 키 기반 인증 미들웨어 (외부 시스템용)
 */
export function withApiKey(
  validApiKeys: string[],
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async function(req: NextRequest): Promise<NextResponse> {
    const apiKey = req.headers.get('x-api-key');
    
    if (!apiKey || !validApiKeys.includes(apiKey)) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_API_KEY',
          message: '유효하지 않은 API 키입니다.',
        },
        { status: 401 }
      );
    }

    return handler(req);
  };
}

/**
 * 개발 환경에서만 접근 가능한 미들웨어
 */
export function withDevelopmentOnly(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async function(req: NextRequest): Promise<NextResponse> {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        {
          success: false,
          error: 'DEVELOPMENT_ONLY',
          message: '개발 환경에서만 사용 가능합니다.',
        },
        { status: 403 }
      );
    }

    return handler(req);
  };
}

/**
 * 속도 제한 미들웨어 (간단한 구현)
 */
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

export function withRateLimit(
  maxRequests: number,
  windowMs: number,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async function(req: NextRequest): Promise<NextResponse> {
    const clientId = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const now = Date.now();
    
    const clientData = rateLimitMap.get(clientId) || { count: 0, lastReset: now };
    
    // 윈도우 시간이 지나면 리셋
    if (now - clientData.lastReset > windowMs) {
      clientData.count = 0;
      clientData.lastReset = now;
    }
    
    clientData.count++;
    rateLimitMap.set(clientId, clientData);
    
    if (clientData.count > maxRequests) {
      return NextResponse.json(
        {
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
        },
        { status: 429 }
      );
    }

    return handler(req);
  };
}

/**
 * 여러 미들웨어를 조합하는 헬퍼 함수
 */
export function compose<T extends NextRequest>(
  ...middlewares: Array<(handler: (req: T) => Promise<NextResponse>) => (req: T) => Promise<NextResponse>>
) {
  return function(handler: (req: T) => Promise<NextResponse>) {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
}