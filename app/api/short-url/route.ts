import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { UrlShortener } from '@/lib/url-shortener';
import { z } from 'zod';

/**
 * Short URL Management API
 * 모바일 교환권 URL 단축 관리
 */

// URL 단축 생성 스키마
const createShortUrlSchema = z.object({
  original_url: z.string().url('유효한 URL을 입력해주세요.'),
  expires_at: z.string().datetime('유효한 만료 시간을 입력해주세요.'),
  user_id: z.string().uuid().optional(),
  metadata: z.object({
    batch_id: z.string().uuid().optional(),
    batch_name: z.string().optional(),
    voucher_count: z.number().optional(),
    template_name: z.string().optional()
  }).optional()
});

// URL 단축 조회 스키마
const getShortUrlSchema = z.object({
  short_code: z.string().length(6, '단축 코드는 6자리여야 합니다.')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('URL 단축 생성 요청:', {
      original_url: body.original_url?.substring(0, 100) + '...',
      expires_at: body.expires_at,
      user_id: body.user_id
    });

    // 입력 검증
    const validation = createShortUrlSchema.safeParse(body);
    if (!validation.success) {
      console.error('입력 검증 실패:', validation.error.errors);
      return NextResponse.json(
        {
          success: false,
          message: '입력 정보가 올바르지 않습니다.',
          errors: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { original_url, expires_at, user_id, metadata } = validation.data;

    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 사용자 확인 (선택사항)
    if (user_id) {
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('id, name')
        .eq('id', user_id)
        .single();

      if (userError || !userProfile) {
        console.error('사용자 확인 실패:', userError);
        return NextResponse.json(
          {
            success: false,
            message: '사용자를 찾을 수 없습니다.'
          },
          { status: 404 }
        );
      }
    }

    // URL 단축기 생성
    const baseUrl = new URL(request.url).origin;
    const shortener = new UrlShortener(baseUrl);

    // 단축 URL 생성
    const shortUrlData = await shortener.createShortUrl(original_url, {
      userId: user_id,
      expiresAt: new Date(expires_at),
      metadata: metadata || {}
    });

    console.log('단축 URL 생성 완료:', {
      short_code: shortUrlData.shortCode,
      short_url: shortUrlData.shortUrl,
      original_length: original_url.length,
      short_length: shortUrlData.shortUrl.length,
      reduction: Math.round((1 - shortUrlData.shortUrl.length / original_url.length) * 100)
    });

    // 감사 로그 생성
    await supabase
      .from('audit_logs')
      .insert({
        action: 'short_url_created',
        actor_user_id: user_id || null,
        details: {
          short_code: shortUrlData.shortCode,
          short_url: shortUrlData.shortUrl,
          original_url_length: original_url.length,
          short_url_length: shortUrlData.shortUrl.length,
          reduction_percentage: Math.round((1 - shortUrlData.shortUrl.length / original_url.length) * 100),
          expires_at: expires_at,
          metadata: metadata || {}
        }
      });

    return NextResponse.json({
      success: true,
      message: '단축 URL이 생성되었습니다.',
      data: {
        id: shortUrlData.id,
        short_code: shortUrlData.shortCode,
        short_url: shortUrlData.shortUrl,
        original_url: original_url,
        expires_at: expires_at,
        click_count: 0,
        reduction_percentage: Math.round((1 - shortUrlData.shortUrl.length / original_url.length) * 100),
        created_at: shortUrlData.createdAt.toISOString()
      }
    });

  } catch (error) {
    console.error('URL 단축 생성 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shortCode = searchParams.get('short_code');
    const userId = searchParams.get('user_id');
    const action = searchParams.get('action'); // 'stats', 'list', 'cleanup'

    // 정리 작업
    if (action === 'cleanup') {
      const daysBefore = Number(searchParams.get('days_before')) || 7;
      const dryRun = searchParams.get('dry_run') === 'true';

      console.log(`단축 URL 정리 ${dryRun ? '시뮬레이션' : '실행'}: ${daysBefore}일 전 만료`);

      if (dryRun) {
        // 시뮬레이션: 정리 대상 조회만
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const cleanupDate = new Date();
        cleanupDate.setDate(cleanupDate.getDate() - daysBefore);

        const { data: expiredUrls, error } = await supabase
          .from('short_urls')
          .select('*')
          .lte('expires_at', cleanupDate.toISOString())
          .order('expires_at', { ascending: true });

        if (error) {
          return NextResponse.json(
            { success: false, message: '정리 대상 조회 실패' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `시뮬레이션: ${expiredUrls?.length || 0}개 단축 URL이 정리 대상입니다.`,
          data: {
            dry_run: true,
            cleanup_date: cleanupDate.toISOString(),
            days_before: daysBefore,
            expired_count: expiredUrls?.length || 0,
            expired_urls: expiredUrls?.map(url => ({
              short_code: url.short_code,
              original_url: url.original_url.substring(0, 100) + '...',
              expires_at: url.expires_at,
              click_count: url.click_count
            })) || []
          }
        });
      } else {
        // 실제 정리 실행
        const shortener = new UrlShortener();
        const deletedCount = await shortener.cleanupExpiredUrls(daysBefore);

        return NextResponse.json({
          success: true,
          message: `${deletedCount}개의 만료된 단축 URL이 정리되었습니다.`,
          data: {
            dry_run: false,
            days_before: daysBefore,
            deleted_count: deletedCount
          }
        });
      }
    }

    // 특정 단축 URL 통계 조회
    if (shortCode) {
      const validation = getShortUrlSchema.safeParse({ short_code: shortCode });
      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            message: '올바른 단축 코드를 입력해주세요.',
            errors: validation.error.errors
          },
          { status: 400 }
        );
      }

      const shortener = new UrlShortener();
      const urlData = await shortener.getShortUrlStats(shortCode);

      if (!urlData) {
        return NextResponse.json(
          {
            success: false,
            message: '단축 URL을 찾을 수 없습니다.'
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          id: urlData.id,
          short_code: urlData.shortCode,
          short_url: urlData.shortUrl,
          original_url: urlData.originalUrl,
          expires_at: urlData.expiresAt.toISOString(),
          click_count: urlData.clickCount,
          created_at: urlData.createdAt.toISOString(),
          is_expired: urlData.expiresAt < new Date()
        }
      });
    }

    // 사용자별 단축 URL 목록 조회
    if (userId) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: shortUrls, error } = await supabase
        .from('short_urls')
        .select('*')
        .eq('created_by_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('사용자 단축 URL 조회 오류:', error);
        return NextResponse.json(
          {
            success: false,
            message: '단축 URL 목록 조회에 실패했습니다.'
          },
          { status: 500 }
        );
      }

      const baseUrl = new URL(request.url).origin;

      return NextResponse.json({
        success: true,
        data: shortUrls?.map(url => ({
          id: url.id,
          short_code: url.short_code,
          short_url: `${baseUrl}/s/${url.short_code}`,
          original_url: url.original_url,
          expires_at: url.expires_at,
          click_count: url.click_count,
          created_at: url.created_at,
          is_expired: new Date(url.expires_at) < new Date(),
          metadata: url.metadata
        })) || []
      });
    }

    // 전체 통계 조회
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { count: totalUrls } = await supabase
      .from('short_urls')
      .select('*', { count: 'exact', head: true });

    const { count: expiredUrls } = await supabase
      .from('short_urls')
      .select('*', { count: 'exact', head: true })
      .lte('expires_at', new Date().toISOString());

    const { data: clickStats } = await supabase
      .from('short_urls')
      .select('click_count')
      .not('click_count', 'is', null);

    const totalClicks = clickStats?.reduce((sum, url) => sum + (url.click_count || 0), 0) || 0;

    return NextResponse.json({
      success: true,
      data: {
        total_urls: totalUrls || 0,
        active_urls: (totalUrls || 0) - (expiredUrls || 0),
        expired_urls: expiredUrls || 0,
        total_clicks: totalClicks,
        average_clicks: totalUrls ? Math.round(totalClicks / totalUrls * 10) / 10 : 0
      }
    });

  } catch (error) {
    console.error('단축 URL 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}