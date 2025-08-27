import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 모바일 교환권 경로에 대해 Vercel 보호 우회
  if (pathname.startsWith('/mobile/vouchers/')) {
    const response = NextResponse.next();
    
    // Vercel 보호 우회 헤더 추가 (환경변수가 있는 경우에만)
    const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (bypassSecret) {
      response.headers.set('x-vercel-protection-bypass', bypassSecret);
      response.headers.set('x-vercel-set-bypass-cookie', 'true');
    }
    
    return response;
  }
  
  // 기타 모든 경로 허용
  return NextResponse.next();
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};