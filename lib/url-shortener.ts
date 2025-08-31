/**
 * URL Shortener Utility
 * 모바일 교환권 URL을 단축하는 유틸리티 함수들
 */

import crypto from 'crypto';
import { createClient } from '@/lib/supabase';

// 임시 인메모리 저장소 (개발/테스트용) - 글로벌 스코프에서 공유
const inMemoryStore = new Map<string, {
  id: string;
  shortCode: string;
  originalUrl: string;
  expiresAt: Date;
  clickCount: number;
  createdAt: Date;
  userId?: string;
  metadata?: any;
}>();

// 글로벌 접근을 위한 함수들
export function getInMemoryStore() {
  return inMemoryStore;
}

export function logInMemoryStoreStatus() {
  console.log('인메모리 저장소 상태:', {
    size: inMemoryStore.size,
    codes: Array.from(inMemoryStore.keys())
  });
}

// Base62 문자셋 (숫자 + 대소문자 영문)
const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE62_LENGTH = BASE62_CHARS.length; // 62

export interface ShortUrlData {
  id: string;
  shortCode: string;
  originalUrl: string;
  shortUrl: string;
  expiresAt: Date;
  clickCount: number;
  createdAt: Date;
}

export interface CreateShortUrlOptions {
  userId?: string;
  expiresAt: Date;
  metadata?: any;
}

export class UrlShortener {
  private readonly baseUrl: string;
  private readonly codeLength: number;

  constructor(baseUrl?: string, codeLength: number = 6) {
    this.baseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    this.codeLength = codeLength;
  }

  /**
   * 안전한 랜덤 Base62 코드 생성
   * 6자리 = 62^6 = 568억 개 조합 가능
   */
  public generateShortCode(length: number = this.codeLength): string {
    const bytes = crypto.randomBytes(length * 2); // 충분한 엔트로피 확보
    let result = '';
    
    for (let i = 0; i < length; i++) {
      // 2바이트로 16비트 값 생성
      const value = (bytes[i * 2] << 8) | bytes[i * 2 + 1];
      // Base62로 매핑
      result += BASE62_CHARS[value % BASE62_LENGTH];
    }
    
    return result;
  }

  /**
   * 숫자를 Base62로 인코딩
   */
  public encodeBase62(num: number): string {
    if (num === 0) return BASE62_CHARS[0];
    
    let result = '';
    while (num > 0) {
      result = BASE62_CHARS[num % BASE62_LENGTH] + result;
      num = Math.floor(num / BASE62_LENGTH);
    }
    
    return result;
  }

  /**
   * Base62를 숫자로 디코딩
   */
  public decodeBase62(str: string): number {
    let result = 0;
    const base = BASE62_LENGTH;
    
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const value = BASE62_CHARS.indexOf(char);
      if (value === -1) {
        throw new Error(`Invalid Base62 character: ${char}`);
      }
      result = result * base + value;
    }
    
    return result;
  }

  /**
   * 단축 코드 유효성 검증
   */
  public isValidShortCode(code: string): boolean {
    if (!code || code.length !== this.codeLength) {
      return false;
    }
    
    // 모든 문자가 Base62 문자셋에 포함되는지 확인
    return [...code].every(char => BASE62_CHARS.includes(char));
  }

  /**
   * 단축 URL 생성 (데이터베이스에 저장)
   */
  public async createShortUrl(
    originalUrl: string,
    options: CreateShortUrlOptions
  ): Promise<ShortUrlData> {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 고유한 단축 코드 생성 (충돌 방지)
    let shortCode = '';
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      shortCode = this.generateShortCode();
      
      // 기존 코드와 충돌하는지 확인
      const { data: existing } = await supabase
        .from('short_urls')
        .select('short_code')
        .eq('short_code', shortCode)
        .single();

      if (!existing) {
        break; // 고유한 코드 발견
      }
      
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Unable to generate unique short code');
    }

    // 단축 URL 데이터베이스에 저장 시도
    try {
      const { data, error } = await supabase
        .from('short_urls')
        .insert({
          short_code: shortCode,
          original_url: originalUrl,
          created_by_user_id: options.userId || null,
          expires_at: options.expiresAt.toISOString(),
          metadata: options.metadata || {}
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      const shortUrl = `${this.baseUrl}/s/${shortCode}`;

      return {
        id: data.id,
        shortCode,
        originalUrl,
        shortUrl,
        expiresAt: new Date(data.expires_at),
        clickCount: data.click_count,
        createdAt: new Date(data.created_at)
      };

    } catch (dbError) {
      console.warn('데이터베이스 저장 실패, 인메모리 저장소 사용:', dbError);
      
      // 인메모리 저장소에 저장 (폴백)
      const id = crypto.randomUUID();
      const createdAt = new Date();
      const shortUrl = `${this.baseUrl}/s/${shortCode}`;
      
      const record = {
        id,
        shortCode,
        originalUrl,
        expiresAt: options.expiresAt,
        clickCount: 0,
        createdAt,
        userId: options.userId,
        metadata: options.metadata
      };
      
      inMemoryStore.set(shortCode, record);
      
      console.log('인메모리 저장소에 저장됨:', { shortCode, originalUrl: originalUrl.substring(0, 50) + '...' });

      return {
        id,
        shortCode,
        originalUrl,
        shortUrl,
        expiresAt: options.expiresAt,
        clickCount: 0,
        createdAt
      };
    }
  }

  /**
   * 단축 URL 조회 및 클릭 추적
   */
  public async resolveShortUrl(shortCode: string): Promise<{
    originalUrl: string | null;
    isExpired: boolean;
    error?: string;
  }> {
    if (!this.isValidShortCode(shortCode)) {
      return {
        originalUrl: null,
        isExpired: false,
        error: 'Invalid short code format'
      };
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // 데이터베이스에서 먼저 조회 시도
      const { data, error } = await supabase.rpc('track_short_url_click', {
        p_short_code: shortCode
      });

      if (!error && data && data.length > 0) {
        const result = data[0];
        return {
          originalUrl: result.original_url,
          isExpired: result.is_expired,
        };
      }

      // 데이터베이스에서 찾지 못한 경우 인메모리 저장소 확인
      console.warn('데이터베이스 조회 실패, 인메모리 저장소 확인:', error);
      
    } catch (dbError) {
      console.warn('데이터베이스 오류, 인메모리 저장소로 폴백:', dbError);
    }

    // 인메모리 저장소에서 조회
    logInMemoryStoreStatus(); // 현재 저장소 상태 로그
    
    const record = inMemoryStore.get(shortCode);
    if (record) {
      // 클릭 수 증가
      record.clickCount++;
      
      // 만료 여부 확인
      const isExpired = new Date() > record.expiresAt;
      
      console.log('인메모리 저장소에서 조회됨:', { shortCode, isExpired, clickCount: record.clickCount });
      
      return {
        originalUrl: record.originalUrl,
        isExpired,
      };
    } else {
      console.log('인메모리 저장소에서 찾을 수 없음:', shortCode);
    }

    return {
      originalUrl: null,
      isExpired: false,
      error: 'Short URL not found'
    };
  }

  /**
   * 단축 URL 통계 조회
   */
  public async getShortUrlStats(shortCode: string): Promise<ShortUrlData | null> {
    if (!this.isValidShortCode(shortCode)) {
      return null;
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('short_urls')
      .select('*')
      .eq('short_code', shortCode)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      shortCode: data.short_code,
      originalUrl: data.original_url,
      shortUrl: `${this.baseUrl}/s/${data.short_code}`,
      expiresAt: new Date(data.expires_at),
      clickCount: data.click_count,
      createdAt: new Date(data.created_at)
    };
  }

  /**
   * 만료된 단축 URL 정리
   */
  public async cleanupExpiredUrls(daysBefore: number = 7): Promise<number> {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      const { data, error } = await supabase.rpc('cleanup_expired_short_urls', {
        days_before: daysBefore
      });

      if (error) {
        console.error('단축 URL 정리 오류:', error);
        return 0;
      }

      return data?.[0]?.deleted_count || 0;
    } catch (error) {
      console.error('단축 URL 정리 중 예외:', error);
      return 0;
    }
  }
}

// 유틸리티 함수들
export function createUrlShortener(baseUrl?: string): UrlShortener {
  return new UrlShortener(baseUrl);
}

export function isValidShortCode(code: string, length: number = 6): boolean {
  const shortener = new UrlShortener();
  return shortener.isValidShortCode(code);
}

export function generateSecureShortCode(length: number = 6): string {
  const shortener = new UrlShortener();
  return shortener.generateShortCode(length);
}

// 기본 인스턴스 생성 및 내보내기
export const urlShortener = new UrlShortener();