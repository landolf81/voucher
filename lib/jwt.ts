import { JWTPayload } from './auth';

// JWT 시크릿 키 (실제 운영 시에는 환경변수에서 가져와야 함)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Base64 URL-safe 변환 함수들
function base64urlEscape(str: string): string {
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlUnescape(str: string): string {
  str += new Array(5 - (str.length % 4)).join('=');
  return str.replace(/\-/g, '+').replace(/_/g, '/');
}

// JWT 토큰 생성
export function generateJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (24 * 60 * 60); // 24시간 유효
    
    const jwtPayload: JWTPayload = {
      ...payload,
      iat: now,
      exp: exp,
    };
    
    // 개발 환경용 간단한 토큰 (서명 없이)
    const token = Buffer.from(JSON.stringify(jwtPayload)).toString('base64');
    console.log('토큰 생성 완료:', token.substring(0, 50) + '...');
    
    return token;
  } catch (error) {
    console.error('JWT 생성 오류:', error);
    throw new Error('JWT 토큰 생성에 실패했습니다.');
  }
}

// JWT 토큰 검증 (개발 환경용 - 서명 검증 생략)
export function verifyJWT(token: string): JWTPayload | null {
  try {
    // 토큰 디코딩
    const payload = JSON.parse(Buffer.from(token, 'base64').toString()) as JWTPayload;
    
    // 만료 시간 검증
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.log('토큰 만료:', { exp: payload.exp, now });
      return null;
    }
    
    console.log('토큰 검증 성공:', payload.name, payload.role);
    return payload;
  } catch (error) {
    console.error('JWT 검증 오류:', error);
    return null;
  }
}

// JWT 토큰에서 사용자 정보 추출
export function extractUserFromJWT(token: string): JWTPayload | null {
  return verifyJWT(token);
}

// JWT 토큰 갱신
export function refreshJWT(token: string): string | null {
  try {
    const payload = verifyJWT(token);
    if (!payload) {
      return null;
    }
    
    // 새로운 만료 시간으로 토큰 재생성
    const { iat, exp, ...userData } = payload;
    return generateJWT(userData);
  } catch (error) {
    console.error('JWT 갱신 오류:', error);
    return null;
  }
}

// JWT 토큰 만료 시간 확인
export function isJWTExpired(token: string): boolean {
  try {
    const payload = verifyJWT(token);
    if (!payload) {
      return true;
    }
    
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch (error) {
    return true;
  }
}

// JWT 토큰에서 특정 클레임 추출
export function getJWTClaim<T>(token: string, claim: keyof JWTPayload): T | null {
  try {
    const payload = verifyJWT(token);
    if (!payload) {
      return null;
    }
    
    return payload[claim] as T;
  } catch (error) {
    return null;
  }
}

// 간단한 HMAC 생성 (실제 운영 시에는 crypto 라이브러리 사용 권장)
function createHMAC(data: string, secret: string): string {
  // 이는 간단한 예시입니다. 실제 운영에서는 crypto.createHmac 사용
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32비트 정수로 변환
  }
  
  // 시크릿과 결합
  for (let i = 0; i < secret.length; i++) {
    const char = secret.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36);
}

// JWT 토큰 정보 출력 (디버깅용)
export function logJWTInfo(token: string): void {
  try {
    const payload = verifyJWT(token);
    if (payload) {
      console.log('JWT 토큰 정보:');
      console.log('- 사용자 ID:', payload.sub);
      console.log('- 휴대폰:', payload.phone || 'N/A');
      console.log('- 역할:', payload.role);
      console.log('- 사업장 ID:', payload.site_id);
      console.log('- 발급 시간:', new Date(payload.iat * 1000).toISOString());
      console.log('- 만료 시간:', new Date(payload.exp * 1000).toISOString());
      console.log('- 만료까지 남은 시간:', Math.floor((payload.exp - Date.now() / 1000) / 60), '분');
    } else {
      console.log('유효하지 않은 JWT 토큰');
    }
  } catch (error) {
    console.error('JWT 정보 출력 오류:', error);
  }
}

// JWT 토큰 헤더에서 Authorization Bearer 토큰 추출
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7); // 'Bearer ' 제거
}

// HTTP 요청에서 JWT 토큰 추출
export function extractTokenFromRequest(req: any): string | null {
  // Authorization 헤더에서 추출
  const authHeader = req.headers?.authorization;
  if (authHeader) {
    const token = extractBearerToken(authHeader);
    if (token) return token;
  }
  
  // 쿠키에서 추출
  const cookies = req.cookies;
  if (cookies?.jwt) {
    return cookies.jwt;
  }
  
  // 쿼리 파라미터에서 추출
  const queryToken = req.query?.token;
  if (queryToken) {
    return queryToken;
  }
  
  return null;
}

// JWT 토큰 검증 미들웨어
export function withJWTVerification(handler: Function) {
  return async function(req: any, res: any) {
    try {
      const token = extractTokenFromRequest(req);
      
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'JWT 토큰이 필요합니다.'
        });
      }
      
      const payload = verifyJWT(token);
      if (!payload) {
        return res.status(401).json({
          success: false,
          error: 'INVALID_TOKEN',
          message: '유효하지 않은 JWT 토큰입니다.'
        });
      }
      
      // 요청 객체에 사용자 정보 추가
      req.user = payload;
      
      return handler(req, res);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'JWT 검증 중 오류가 발생했습니다.'
      });
    }
  };
}
