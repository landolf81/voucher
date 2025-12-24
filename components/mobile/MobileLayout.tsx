'use client';

import React from 'react';
import { MobileNavigation } from './MobileNavigation';

interface MobileLayoutProps {
  children: React.ReactNode;
  showNavigation?: boolean;
}

export function MobileLayout({ children, showNavigation = true }: MobileLayoutProps) {
  return (
    <div style={{
      minHeight: '100vh',
      height: 'auto',
      backgroundColor: '#f8fafc',
      position: 'relative',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'visible',
      // 다크모드에서도 밝은 배경/어두운 텍스트 유지
      colorScheme: 'light'
    }}>
      {/* 메인 컨텐츠 */}
      <main style={{
        paddingBottom: showNavigation ? '80px' : '0',
        display: 'block',
        visibility: 'visible',
        opacity: 1,
        minHeight: 'calc(100vh - 80px)',
        color: '#1f2937',
        overflow: 'visible'
      }}>
        {children}
      </main>

      {/* 하단 네비게이션 */}
      {showNavigation && <MobileNavigation />}
    </div>
  );
}