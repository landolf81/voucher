'use client';

/**
 * 보호된 라우트 래퍼 컴포넌트
 */

import React from 'react';
import { useAuth, useRequireAuth, useRequireRole, useRequirePageAccess } from '@/lib/contexts/AuthContext';
import { UserRole } from '@/lib/auth/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireRole?: UserRole;
  requirePath?: string;
  fallback?: React.ReactNode;
}

/**
 * 인증이 필요한 페이지를 보호하는 컴포넌트
 */
export function ProtectedRoute({ 
  children, 
  requireAuth = true,
  requireRole,
  requirePath,
  fallback 
}: ProtectedRouteProps) {
  const { isLoading, isAuthenticated } = useAuth();

  // Hook들을 항상 호출 (조건부 로직은 Hook 내부에서 처리)
  const authStatus = useRequireAuth();
  const roleStatus = useRequireRole(requireRole || '');
  const pathStatus = useRequirePageAccess(requirePath || '');

  // 실제 보호 로직 적용
  if (requireAuth && !authStatus) return null;
  if (requireRole && !roleStatus) return null;
  if (requirePath && !pathStatus) return null;

  // 로딩 중
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #007bff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ color: '#666', fontSize: '14px' }}>
          인증 확인 중...
        </p>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // 인증이 필요하지만 로그인하지 않은 경우
  if (requireAuth && !isAuthenticated) {
    return fallback || (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <h2 style={{ color: '#333', marginBottom: '8px' }}>
          로그인이 필요합니다
        </h2>
        <p style={{ color: '#666', fontSize: '14px', textAlign: 'center' }}>
          이 페이지에 접근하려면 로그인이 필요합니다.<br />
          잠시 후 로그인 페이지로 이동합니다.
        </p>
      </div>
    );
  }

  // 모든 조건을 만족하면 자식 컴포넌트 렌더링
  return <>{children}</>;
}

/**
 * 관리자 전용 라우트 래퍼
 */
export function AdminRoute({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <ProtectedRoute 
      requireAuth={true} 
      requireRole="admin" 
      fallback={fallback}
    >
      {children}
    </ProtectedRoute>
  );
}

/**
 * 직원 전용 라우트 래퍼
 */
export function StaffRoute({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <ProtectedRoute 
      requireAuth={true} 
      requireRole="staff" 
      fallback={fallback}
    >
      {children}
    </ProtectedRoute>
  );
}

/**
 * 로그인하지 않은 사용자만 접근 가능한 라우트 (로그인 페이지 등)
 */
export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, user } = useAuth();

  // 로딩 중
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #007bff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // 이미 로그인한 경우 기본 페이지로 리다이렉트
  if (isAuthenticated && user) {
    window.location.href = user.role === 'admin' ? '/admin/dashboard' : '/scan';
    return null;
  }

  return <>{children}</>;
}

/**
 * 권한별 컴포넌트 조건부 렌더링
 */
interface RoleBasedProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  fallback?: React.ReactNode;
}

export function RoleBased({ children, allowedRoles, fallback }: RoleBasedProps) {
  const { user } = useAuth();
  
  if (!user || !allowedRoles.includes(user.role)) {
    return <>{fallback}</> || null;
  }
  
  return <>{children}</>;
}

/**
 * 페이지별 접근 권한 래퍼
 */
interface PageAccessProps {
  children: React.ReactNode;
  pathname: string;
  fallback?: React.ReactNode;
}

export function PageAccess({ children, pathname, fallback }: PageAccessProps) {
  const { canAccess } = useAuth();
  
  if (!canAccess(pathname)) {
    return <>{fallback}</> || (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '50vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <h3 style={{ color: '#333', marginBottom: '8px' }}>
          접근 권한이 없습니다
        </h3>
        <p style={{ color: '#666', fontSize: '14px', textAlign: 'center' }}>
          이 페이지에 접근할 권한이 없습니다.
        </p>
      </div>
    );
  }
  
  return <>{children}</>;
}