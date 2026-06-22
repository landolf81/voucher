'use client';

/**
 * 모바일 홈 = AI 업무 어시스턴트(Hermes 챗봇).
 * 업무관리 메뉴(공지/일정/쪽지/더보기)는 하단 네비로 이동.
 */

import React from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { MobileNavigation } from '@/components/mobile/MobileNavigation';
import { ChatAssistant } from '@/components/admin/chat/ChatAssistant';

export default function MobileHomePage() {
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
        }}
      >
        <main style={{ flex: 1, minHeight: 0, padding: '8px', paddingBottom: '84px' }}>
          <ChatAssistant />
        </main>
        <MobileNavigation />
      </div>
    </ProtectedRoute>
  );
}
