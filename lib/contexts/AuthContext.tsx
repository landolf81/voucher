'use client';

/**
 * Supabase 인증 컨텍스트 제공자
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient, resetSupabaseClient } from '@/lib/supabase';
import { UserRole, getDefaultRedirectUrl, canAccessPage } from '@/lib/auth/permissions';
import { formatPhoneForDisplay } from '@/lib/phone-utils';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface User {
  id: string;
  email: string;
  phone?: string;
  name: string;
  role: UserRole;
  site_id: string;
  site_name?: string;
  is_active: boolean;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkPermission: (permission: string) => boolean;
  canAccess: (pathname: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null); // 중복 방지용
  const router = useRouter();
  const supabase = getSupabaseClient();

  // 초기 인증 상태 확인 및 auth 상태 변경 감지
  useEffect(() => {
    // 현재 세션 확인
    checkAuthStatus();

    // auth 상태 변경 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('SIGNED_IN 이벤트 처리 시작');
          
          // 이미 같은 사용자가 로딩 중이면 중복 호출 방지
          if (loadingUserId === session.user.id) {
            console.log('중복 프로필 로딩 방지:', session.user.id);
            return;
          }
          
          // 짧은 debounce로 중복 이벤트 방지
          setTimeout(async () => {
            // 한 번 더 확인
            if (loadingUserId === session.user.id) {
              console.log('debounce 후 중복 프로필 로딩 방지:', session.user.id);
              return;
            }
            await loadUserProfile(session.user);
          }, 100);
        } else if (event === 'SIGNED_OUT') {
          console.log('SIGNED_OUT 이벤트 처리');
          setUser(null);
          setLoadingUserId(null);
          setIsLoading(false);
          router.push('/login');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // 인증 상태 확인 (타임아웃 추가)
  const checkAuthStatus = async () => {
    console.log('checkAuthStatus 시작');
    try {
      // 5초 타임아웃 추가
      const timeoutPromise = new Promise((resolve) => 
        setTimeout(() => resolve({ data: { user: null }, error: new Error('getUser timeout') }), 5000)
      );
      
      const getUserPromise = supabase.auth.getUser();
      const result = await Promise.race([getUserPromise, timeoutPromise]) as any;
      const { data: { user: authUser } } = result;
      
      console.log('getUser 결과:', authUser?.id);
      
      if (authUser) {
        await loadUserProfile(authUser);
      } else {
        console.log('authUser 없음');
        setUser(null);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('인증 상태 확인 오류:', error);
      setUser(null);
      setIsLoading(false);
    }
    console.log('checkAuthStatus 완료');
  };

  // 사용자 프로필 로드
  const loadUserProfile = async (authUser: SupabaseUser) => {
    console.log('loadUserProfile 시작:', authUser.id);
    
    // 이미 프로필 로딩 중이거나 같은 사용자면 중단
    if (isLoadingProfile || loadingUserId === authUser.id) {
      console.log('이미 프로필 로딩 중이므로 중단');
      return;
    }
    
    setLoadingUserId(authUser.id);
    setIsLoadingProfile(true);
    try {
      // 먼저 metadata에서 프로필 정보 확인
      const metadata = authUser.user_metadata;
      console.log('metadata:', metadata);
      
      // metadata 기반 로그인은 현재 사용하지 않으므로 바로 user_profiles로 이동
      // if (metadata && metadata.user_id && metadata.name) {
      //   // OTP 로그인으로 metadata가 있는 경우
      //   console.log('metadata 기반 사용자 데이터 설정');
      //   const userData: User = {
      //     id: authUser.id,
      //     email: authUser.email || '',
      //     phone: formatPhoneForDisplay(authUser.phone),
      //     name: metadata.name,
      //     role: metadata.role || 'staff',
      //     site_id: metadata.site_id || '',
      //     site_name: '',
      //     is_active: true
      //   };
      //   
      //   setUser(userData);
      //   setIsLoading(false);
      //   setIsLoadingProfile(false);
      //   console.log('metadata 기반 로딩 완료');
      //   return;
      // }

      // 기존 방식: user_profiles 테이블에서 조회 (타임아웃 추가)
      console.log('user_profiles 테이블 조회 시작');
      
      const timeoutPromise = new Promise((resolve) => 
        setTimeout(() => resolve({ data: null, error: new Error('profile query timeout') }), 5000)
      );
      
      // 임시로 RLS 문제를 우회하기 위해 직접 조회 시도
      const profilePromise = supabase
        .from('user_profiles')
        .select(`
          *,
          sites (
            id,
            site_name
          )
        `)
        .eq('id', authUser.id)
        .maybeSingle(); // single() 대신 maybeSingle() 사용
      
      const { data: profile, error } = await Promise.race([profilePromise, timeoutPromise]) as any;

      if (error) {
        console.error('프로필 로드 오류:', error);
        
        // user_profiles에 데이터가 없으면 로그아웃 처리
        console.log('프로필 없음, 로그아웃 처리');
        await supabase.auth.signOut();
        setUser(null);
        setIsLoading(false);
        setIsLoadingProfile(false);
        setLoadingUserId(null);
        console.log('프로필 없음으로 인한 로그아웃 완료');
        router.push('/login');
        return;
      }

      if (profile) {
        console.log('프로필 발견:', profile.name);
        const userData: User = {
          id: authUser.id,
          email: authUser.email || '',
          phone: formatPhoneForDisplay(authUser.phone),
          name: profile.name,
          role: profile.role,
          site_id: profile.site_id,
          site_name: profile.sites?.site_name,
          is_active: profile.is_active
        };

        setUser(userData);
      } else {
        console.log('프로필 없음, 로그아웃 처리');
        await supabase.auth.signOut();
        setUser(null);
        setIsLoading(false);
        setIsLoadingProfile(false);
        setLoadingUserId(null);
        console.log('프로필 없음으로 인한 로그아웃 완료');
        router.push('/login');
        return;
      }
      setIsLoading(false);
      setIsLoadingProfile(false);
      setLoadingUserId(null);
      console.log('프로필 기반 로딩 완료');
    } catch (error) {
      console.error('프로필 로드 오류:', error);
      
      // 예외 발생 시도 로그아웃 처리
      console.log('예외 발생, 로그아웃 처리');
      await supabase.auth.signOut();
      setUser(null);
      setIsLoading(false);
      setIsLoadingProfile(false);
      setLoadingUserId(null);
      console.log('예외 발생으로 인한 로그아웃 완료');
      router.push('/login');
    }
  };

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

      if (data.user) {
        await loadUserProfile(data.user);
        
        // 역할에 따른 기본 페이지로 리다이렉트는 onAuthStateChange에서 처리
        return { success: true };
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
      
      // 모든 저장소에서 Supabase 관련 데이터 완전 제거
      const localStorageKeys = Object.keys(localStorage);
      localStorageKeys.forEach(key => {
        if (key.includes('supabase') || key.includes('sb-')) {
          localStorage.removeItem(key);
          console.log('localStorage 제거:', key);
        }
      });
      
      const sessionStorageKeys = Object.keys(sessionStorage);
      sessionStorageKeys.forEach(key => {
        if (key.includes('supabase') || key.includes('sb-')) {
          sessionStorage.removeItem(key);
          console.log('sessionStorage 제거:', key);
        }
      });
      
      // IndexedDB 정리 (Supabase가 사용할 수 있는 저장소)
      if ('indexedDB' in window) {
        try {
          const dbs = await indexedDB.databases();
          dbs.forEach(db => {
            if (db.name && (db.name.includes('supabase') || db.name.includes('sb-'))) {
              indexedDB.deleteDatabase(db.name);
              console.log('IndexedDB 제거:', db.name);
            }
          });
        } catch (e) {
          console.log('IndexedDB 정리 건너뜀:', e);
        }
      }
      
      // Supabase 클라이언트 인스턴스도 재설정
      resetSupabaseClient();
      
      setUser(null);
      
      console.log('완전 로그아웃 완료 - 페이지 새로고침');
      // 완전한 페이지 새로고침으로 모든 상태 초기화
      window.location.href = '/login';
    } catch (error) {
      console.error('로그아웃 오류:', error);
      // 오류가 발생해도 로컬 상태는 정리
      setUser(null);
      window.location.href = '/login';
    }
  };

  // 권한 확인
  const checkPermission = (permission: string): boolean => {
    if (!user) return false;
    
    // 권한 확인 로직 구현
    // 실제로는 permissions.ts의 hasPermission 함수 사용
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
        // 권한이 없으면 기본 페이지로 리다이렉트
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
        // 접근 권한이 없으면 기본 페이지로 리다이렉트
        const defaultUrl = getDefaultRedirectUrl(user.role);
        router.push(defaultUrl);
      }
    }
  }, [user, isLoading, pathname, canAccess, router]);
}