'use client';

/**
 * 모바일 업무관리 셸 — 고정 높이(100dvh) + 하단 네비 + 본문 영역.
 * 본문에는 height:100% 기반 반응형 패널(공지/일정/쪽지 등)을 그대로 넣을 수 있다.
 */

import React from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { MobileNavigation } from './MobileNavigation';

export function MobileShell({
  title,
  children,
  noPadding = false,
}: {
  title?: string;
  children: React.ReactNode;
  noPadding?: boolean;
}) {
  return (
    <ProtectedRoute>
      <div
        style={{
          height: '100dvh',
          maxHeight: '100dvh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f8fafc',
          colorScheme: 'light',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {title && (
          <header
            style={{
              flexShrink: 0,
              height: '52px',
              backgroundColor: '#fff',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
            }}
          >
            <h1 style={{ fontSize: '17px', fontWeight: 700, color: '#1a202c', margin: 0 }}>{title}</h1>
          </header>
        )}
        <main
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            padding: noPadding ? 0 : '12px',
            paddingBottom: noPadding ? '72px' : '84px',
          }}
        >
          {children}
        </main>
        <MobileNavigation />
      </div>
    </ProtectedRoute>
  );
}

export default MobileShell;
