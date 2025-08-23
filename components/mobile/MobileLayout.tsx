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
      backgroundColor: '#f8fafc',
      position: 'relative',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* 메인 컨텐츠 */}
      <main style={{
        paddingBottom: showNavigation ? '80px' : '0' // 하단 네비게이션 공간 확보
      }}>
        {children}
      </main>

      {/* 하단 네비게이션 */}
      {showNavigation && <MobileNavigation />}
    </div>
  );
}