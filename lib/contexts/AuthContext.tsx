'use client';

/**
 * Supabase 인증 컨텍스트 제공자
 * - 로컬 캐시 우선 사용으로 Supabase auth 요청 최소화
 * - 중복 프로필 로딩 방지
 */

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient, resetSupabaseClient } from '@/lib/supabase';
import { UserRole, getDefaultRedirectUrl, canAccessPage } from '@/lib/auth/permissions';
import { formatPhoneForDisplay } from '@/lib/phone-utils';
import type { User as SupabaseUser } from '@supabase/supabase-js';

const AUTH_CACHE_KEY = 'voucher_auth_cache';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5분

export interface User {
  id: string;
  email?: string;
  phone?: string;
  /** 사원번호 (display_name) */
  display_name: string;
  name: string;
  role: UserRole;
  site_id: string;
  site_name?: string;
  is_active: boolean;
  oauth_provider?: string;
  oauth_provider_id?: string;
  oauth_linked_at?: string;
}

interface CachedAuth {
  user: User;
  timestamp: number;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkPermission: (permission: string) => boolean;
  canAccess: (pathname: string) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 캐시 관련 유틸리티
function getCachedAuth(): CachedAuth | null {
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedAuth = JSON.parse(cached);
    const now = Date.now();

    // 캐시 만료 확인
    if (now - parsed.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function setCachedAuth(user: User): void {
  try {
    const cached: CachedAuth = {
      user,
      timestamp: Date.now()
    };
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // 캐시 저장 실패 무시
  }
}

function clearCachedAuth(): void {
  try {
    localStorage.removeItem(AUTH_CACHE_KEY);
  } catch {
    // 캐시 삭제 실패 무시
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = getSupabaseClient();

  // 중복 로딩 방지용 ref
  const isLoadingRef = useRef(false);
  const loadedUserIdRef = useRef<string | null>(null);
  const initCompletedRef = useRef(false);

  // 사용자 프로필 로드 (캐시 우선)
  // accessToken을 옵션으로 받아서 getSession() 호출 회피
  const loadUserProfile = useCallback(async (
    authUser: SupabaseUser,
    forceRefresh = false,
    accessTokenParam?: string
  ): Promise<User | null> => {
    const userId = authUser.id;

    // 이미 같은 사용자 로딩 완료
    if (!forceRefresh && loadedUserIdRef.current === userId && user) {
      setIsLoading(false);
      return user;
    }

    // 중복 로딩 방지
    if (isLoadingRef.current && loadedUserIdRef.current === userId) {
      return null;
    }

    // 캐시 확인 (강제 새로고침이 아닌 경우)
    if (!forceRefresh) {
      const cached = getCachedAuth();
      if (cached && cached.user.id === userId) {
        console.log('캐시된 프로필 사용:', cached.user.name);
        setUser(cached.user);
        loadedUserIdRef.current = userId;
        setIsLoading(false);
        return cached.user;
      }
    }

    isLoadingRef.current = true;
    loadedUserIdRef.current = userId;

    try {
      console.log('프로필 API 조회 시작:', userId);

      // accessToken이 전달되었으면 사용, 아니면 getSession() 호출
      let accessToken = accessTokenParam;
      if (!accessToken) {
        console.log('getSession 호출 중...');
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token;
        console.log('getSession 완료:', accessToken ? '토큰있음' : '토큰없음');
      }

      if (!accessToken) {
        console.error('액세스 토큰 없음 - 로그인 페이지로 이동');
        clearCachedAuth();
        setIsLoading(false);
        router.push('/login');
        return null;
      }

      // API를 통해 프로필 조회 (service_role로 RLS 우회)
      console.log('/api/auth/me 요청 시작...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      console.log('/api/auth/me 응답:', response.status);

      clearTimeout(timeoutId);

      // 401 에러 = 토큰 무효 → 로그아웃 처리
      if (response.status === 401) {
        console.log('토큰 무효 (401) - 로그아웃 처리');
        await supabase.auth.signOut();
        clearCachedAuth();
        setUser(null);
        loadedUserIdRef.current = null;
        setIsLoading(false);
        router.push('/login');
        return null;
      }

      const result = await response.json();
      console.log('프로필 API 응답:', result.success ? '성공' : '실패', result.message || '');

      if (!result.success || !result.data) {
        console.error('프로필 로드 오류:', result.message || '프로필 없음');

        // OAuth 사용자 확인
        const isOAuthUser = authUser.app_metadata?.provider !== 'email';
        if (isOAuthUser) {
          console.log('OAuth 사용자 프로필 없음 - 연동 필요');
          await supabase.auth.signOut();
          clearCachedAuth();
          setIsLoading(false);
          router.push('/login?oauth_linking_required=true');
          return null;
        }

        setIsLoading(false);
        return null;
      }

      const profileData = result.data;
      console.log('프로필 발견:', profileData.name);
      const userData: User = {
        id: authUser.id,
        email: profileData.email || authUser.email || undefined,
        phone: formatPhoneForDisplay(profileData.phone || authUser.phone),
        display_name: profileData.display_name || profileData.user_id || '', // user_metadata.display_name 또는 user_profiles.user_id
        name: profileData.name,
        role: profileData.role,
        site_id: profileData.site_id,
        site_name: profileData.sites?.site_name || profileData.site_name,
        is_active: profileData.is_active ?? true,
        oauth_provider: profileData.oauth_provider || undefined,
        oauth_provider_id: profileData.oauth_provider_id || undefined,
        oauth_linked_at: profileData.oauth_linked_at || undefined
      };

      // 캐시 저장
      setCachedAuth(userData);
      setUser(userData);
      setIsLoading(false);
      console.log('프로필 로드 완료, isLoading = false');

      return userData;
    } catch (error) {
      console.error('프로필 로드 예외:', error);
      setIsLoading(false);
      return null;
    } finally {
      isLoadingRef.current = false;
    }
  }, [supabase, router, user]);

  // 초기화 (한 번만 실행)
  useEffect(() => {
    if (initCompletedRef.current) return;
    initCompletedRef.current = true;

    console.log('AuthContext 초기화 시작');

    // 초기 세션 확인 함수
    const initializeAuth = async () => {
      // 1. 먼저 로컬 캐시 확인
      const cached = getCachedAuth();
      if (cached) {
        console.log('캐시된 사용자 발견:', cached.user.name);
        setUser(cached.user);
        loadedUserIdRef.current = cached.user.id;
        setIsLoading(false);
        return; // 캐시가 있으면 즉시 완료
      }

      // 2. 캐시 없으면 getSession으로 세션 확인
      console.log('캐시 없음, 세션 확인 중...');
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('세션 확인 오류:', error);
          setIsLoading(false);
          return;
        }

        if (session?.user) {
          console.log('세션 발견, 프로필 로드');
          // access_token을 직접 전달하여 getSession() 중복 호출 방지
          await loadUserProfile(session.user, false, session.access_token);
        } else {
          console.log('세션 없음 - 로그인 필요');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('세션 확인 예외:', error);
        setIsLoading(false);
      }
    };

    // 초기화 실행
    initializeAuth();

    // auth 상태 변경 리스너 (로그인/로그아웃/토큰갱신 이벤트 처리용)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth 이벤트:', event, '현재 loadedUserId:', loadedUserIdRef.current);

        // INITIAL_SESSION: 구독 시 현재 세션 상태 알림 (캐시 있으면 무시)
        if (event === 'INITIAL_SESSION') {
          if (loadedUserIdRef.current) {
            console.log('캐시에서 이미 로드됨, INITIAL_SESSION 무시');
            return;
          }
          // 캐시 없고 세션 있으면 프로필 로드
          if (session?.user) {
            console.log('INITIAL_SESSION에서 프로필 로드');
            await loadUserProfile(session.user, false, session.access_token);
          }
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          // 새 로그인 (이미 로드된 사용자면 무시)
          if (loadedUserIdRef.current === session.user.id) {
            console.log('동일 사용자 SIGNED_IN 무시');
            return;
          }
          console.log('새 로그인 감지, 프로필 로드');
          // access_token을 직접 전달하여 getSession() 호출 회피
          await loadUserProfile(session.user, false, session.access_token);
        } else if (event === 'SIGNED_OUT') {
          console.log('로그아웃');
          clearCachedAuth();
          setUser(null);
          loadedUserIdRef.current = null;
          setIsLoading(false);
          router.push('/login');
        } else if (event === 'TOKEN_REFRESHED') {
          // 토큰 갱신 시 캐시 타임스탬프 업데이트
          const cachedData = getCachedAuth();
          if (cachedData) {
            setCachedAuth(cachedData.user);
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, loadUserProfile, router]);

  // 프로필 새로고침 (수동)
  const refreshProfile = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await loadUserProfile(authUser, true);
    }
  }, [supabase, loadUserProfile]);

  // 로그인
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return {
          success: false,
          error: error.message === 'Invalid login credentials'
            ? '이메일 또는 비밀번호가 잘못되었습니다.'
            : '로그인에 실패했습니다.'
        };
      }

      if (data.user && data.session) {
        // access_token 직접 전달
        const userData = await loadUserProfile(data.user, false, data.session.access_token);
        if (userData) {
          return { success: true };
        }
        return { success: false, error: '프로필을 찾을 수 없습니다.' };
      }

      return { success: false, error: '로그인에 실패했습니다.' };
    } catch (error) {
      console.error('로그인 오류:', error);
      return { success: false, error: '로그인 중 오류가 발생했습니다.' };
    }
  };

  // 로그아웃
  const logout = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();

      // 캐시 삭제
      clearCachedAuth();

      // 모든 저장소에서 Supabase 관련 데이터 제거
      const localStorageKeys = Object.keys(localStorage);
      localStorageKeys.forEach(key => {
        if (key.includes('supabase') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });

      const sessionStorageKeys = Object.keys(sessionStorage);
      sessionStorageKeys.forEach(key => {
        if (key.includes('supabase') || key.includes('sb-')) {
          sessionStorage.removeItem(key);
        }
      });

      // IndexedDB 정리
      if ('indexedDB' in window) {
        try {
          const dbs = await indexedDB.databases();
          dbs.forEach(db => {
            if (db.name && (db.name.includes('supabase') || db.name.includes('sb-'))) {
              indexedDB.deleteDatabase(db.name);
            }
          });
        } catch (e) {
          // IndexedDB 정리 실패 무시
        }
      }

      // Supabase 클라이언트 재설정
      resetSupabaseClient();

      setUser(null);
      loadedUserIdRef.current = null;

      window.location.href = '/login';
    } catch (error) {
      console.error('로그아웃 오류:', error);
      clearCachedAuth();
      setUser(null);
      window.location.href = '/login';
    }
  };

  // 권한 확인
  const checkPermission = (_permission: string): boolean => {
    if (!user) return false;
    return true; // 임시로 모든 권한 허용
  };

  // 페이지 접근 권한 확인
  const canAccess = (pathname: string): boolean => {
    if (!user) return false;
    return canAccessPage(user.role, pathname);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    checkPermission,
    canAccess,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// 인증 컨텍스트 사용 훅
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// 로그인 상태 확인 훅
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

// 사용자 정보 훅
export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

// 권한 확인 훅
export function usePermission(permission: string): boolean {
  const { checkPermission } = useAuth();
  return checkPermission(permission);
}

// 역할 확인 훅
export function useRole(): UserRole | null {
  const { user } = useAuth();
  return user?.role || null;
}

// 관리자 여부 확인 훅
export function useIsAdmin(): boolean {
  const role = useRole();
  return role === 'admin';
}

// 로그인 필요 확인 훅
export function useRequireAuth(): void {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);
}

// 특정 역할 필요 확인 훅
export function useRequireRole(requiredRole: UserRole): void {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== requiredRole) {
        const defaultUrl = getDefaultRedirectUrl(user.role);
        router.push(defaultUrl);
      }
    }
  }, [user, isLoading, requiredRole, router]);
}

// 페이지 접근 권한 확인 훅
export function useRequirePageAccess(pathname: string): void {
  const { user, isLoading, canAccess } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (!canAccess(pathname)) {
        const defaultUrl = getDefaultRedirectUrl(user.role);
        router.push(defaultUrl);
      }
    }
  }, [user, isLoading, pathname, canAccess, router]);
}
