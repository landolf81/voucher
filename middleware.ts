import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // 모든 경로 허용
  return NextResponse.next();
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};