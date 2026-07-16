'use client';

/**
 * 모바일 페이지 권한 게이트 — 허용된 role이 아니면 안내 문구만 표시.
 * (API는 서버측 권한검사로 별도 보호됨)
 */

import React from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Lock } from 'lucide-react';

export function MobileRoleGate({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  const role = user?.role || 'viewer';

  if (!roles.includes(role)) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          color: '#94a3b8',
        }}
      >
        <Lock size={32} />
        <div style={{ fontSize: '15px', fontWeight: 600 }}>접근 권한이 없습니다</div>
      </div>
    );
  }

  return <>{children}</>;
}
