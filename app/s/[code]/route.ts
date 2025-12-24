import { NextRequest, NextResponse } from 'next/server';
import { UrlShortener, isValidShortCode } from '@/lib/url-shortener';

/**
 * Short URL Redirect Handler
 * /s/{code} 형태의 단축 URL을 원본 URL로 리다이렉트
 */

interface RouteParams {
  params: Promise<{
    code: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { code } = await params;
    
    console.log('단축 URL 접근:', {
      code,
      user_agent: request.headers.get('user-agent')?.substring(0, 100),
      referer: request.headers.get('referer'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    // 단축 코드 유효성 검증
    if (!isValidShortCode(code)) {
      console.error('잘못된 단축 코드 형식:', code);
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>잘못된 링크</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: 'Malgun Gothic', sans-serif; 
              text-align: center; 
              padding: 50px; 
              background: #f5f5f5; 
            }
            .container { 
              background: white; 
              padding: 40px; 
              border-radius: 12px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              max-width: 400px;
              margin: 0 auto;
            }
            .icon { font-size: 48px; margin-bottom: 20px; }
            h1 { color: #ef4444; margin-bottom: 16px; }
            p { color: #6b7280; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h1>잘못된 링크</h1>
            <p>요청하신 링크가 올바르지 않습니다.<br>다시 확인해주세요.</p>
          </div>
        </body>
        </html>
        `,
        { 
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }
      );
    }

    // URL 단축기를 통한 원본 URL 조회
    const baseUrl = new URL(request.url).origin;
    const shortener = new UrlShortener(baseUrl);
    
    const result = await shortener.resolveShortUrl(code);

    // 오류 처리
    if (result.error || !result.originalUrl) {
      console.error('단축 URL 조회 실패:', { code, error: result.error });
      
      let errorTitle = '링크를 찾을 수 없습니다';
      let errorMessage = '요청하신 링크가 존재하지 않거나 삭제되었습니다.';
      
      if (result.error === 'Short URL not found') {
        errorTitle = '링크를 찾을 수 없습니다';
        errorMessage = '요청하신 링크가 존재하지 않습니다. 링크를 다시 확인해주세요.';
      }
      
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${errorTitle}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: 'Malgun Gothic', sans-serif; 
              text-align: center; 
              padding: 50px; 
              background: #f5f5f5; 
            }
            .container { 
              background: white; 
              padding: 40px; 
              border-radius: 12px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              max-width: 400px;
              margin: 0 auto;
            }
            .icon { font-size: 48px; margin-bottom: 20px; }
            h1 { color: #ef4444; margin-bottom: 16px; }
            p { color: #6b7280; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">🔍</div>
            <h1>${errorTitle}</h1>
            <p>${errorMessage}</p>
          </div>
        </body>
        </html>
        `,
        { 
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }
      );
    }

    // 만료된 링크 처리
    if (result.isExpired) {
      console.warn('만료된 단축 URL 접근:', { code, original_url: result.originalUrl });
      
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>링크가 만료되었습니다</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: 'Malgun Gothic', sans-serif; 
              text-align: center; 
              padding: 50px; 
              background: #f5f5f5; 
            }
            .container { 
              background: white; 
              padding: 40px; 
              border-radius: 12px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              max-width: 400px;
              margin: 0 auto;
            }
            .icon { font-size: 48px; margin-bottom: 20px; }
            h1 { color: '#f59e0b'; margin-bottom: 16px; }
            p { color: #6b7280; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">⏰</div>
            <h1>링크가 만료되었습니다</h1>
            <p>요청하신 교환권 링크의 사용 기한이 만료되었습니다.<br>새로운 링크가 필요하시면 관리자에게 문의해주세요.</p>
          </div>
        </body>
        </html>
        `,
        { 
          status: 410, // Gone
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }
      );
    }

    console.log('단축 URL 리다이렉트 성공:', {
      code,
      original_url: result.originalUrl?.substring(0, 100) + '...',
      redirect_length_reduction: result.originalUrl ? 
        Math.round((1 - request.url.length / result.originalUrl.length) * 100) : 0
    });

    // 정상적인 리다이렉트
    // Vercel 보호 우회 파라미터가 포함된 경우 쿠키 설정
    const response = NextResponse.redirect(result.originalUrl, 302);
    
    // Vercel 보호 우회를 위한 쿠키 설정 (원본 URL에 파라미터가 있는 경우)
    const originalUrl = new URL(result.originalUrl);
    const bypassSecret = originalUrl.searchParams.get('x-vercel-protection-bypass');
    const setCookie = originalUrl.searchParams.get('x-vercel-set-bypass-cookie');
    
    if (bypassSecret && setCookie === 'true') {
      response.cookies.set('x-vercel-protection-bypass', bypassSecret, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 // 24시간
      });
      
      // URL에서 파라미터 제거 (더 깔끔한 리다이렉트)
      originalUrl.searchParams.delete('x-vercel-protection-bypass');
      originalUrl.searchParams.delete('x-vercel-set-bypass-cookie');
      
      // 파라미터가 제거된 URL로 리다이렉트
      return NextResponse.redirect(originalUrl.toString(), 302);
    }

    return response;

  } catch (error) {
    console.error('단축 URL 리다이렉트 오류:', error);
    
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>서버 오류</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: 'Malgun Gothic', sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: #f5f5f5; 
          }
          .container { 
            background: white; 
            padding: 40px; 
            border-radius: 12px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 400px;
            margin: 0 auto;
          }
          .icon { font-size: 48px; margin-bottom: 20px; }
          h1 { color: #ef4444; margin-bottom: 16px; }
          p { color: #6b7280; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">⚠️</div>
          <h1>일시적 오류</h1>
          <p>서비스 처리 중 오류가 발생했습니다.<br>잠시 후 다시 시도해주세요.</p>
        </div>
      </body>
      </html>
      `,
      { 
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    );
  }
}

// HEAD 요청 처리 (일부 봇이나 링크 미리보기에서 사용)
export async function HEAD(request: NextRequest, { params }: RouteParams) {
  try {
    const { code } = await params;
    
    if (!isValidShortCode(code)) {
      return new NextResponse(null, { status: 400 });
    }

    const baseUrl = new URL(request.url).origin;
    const shortener = new UrlShortener(baseUrl);
    const result = await shortener.resolveShortUrl(code);

    if (result.error || !result.originalUrl || result.isExpired) {
      return new NextResponse(null, { status: 404 });
    }

    return NextResponse.redirect(result.originalUrl, 302);
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}