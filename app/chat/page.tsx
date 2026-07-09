'use client';

/**
 * 메인 화면: AI 챗봇 (로그인 후 기본 진입 화면)
 * 기존 관리 기능은 우측 상단 "관리자 화면" 버튼으로 이동.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { AdminRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useDevice } from '@/lib/hooks/useDevice';
import { ChatAssistant } from '@/components/admin/chat/ChatAssistant';
import { Bot, ArrowLeft, FolderOpen } from 'lucide-react';

export default function ChatHomePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const device = useDevice();
  const isMobile = device.isMobile;

  return (
    <AdminRoute>
      <div
        style={{
          // 모바일 주소창/하단바를 제외한 실제 보이는 높이(dvh)로 맞춰 입력창이 가려지지 않게 함
          height: '100dvh',
          maxHeight: '100dvh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f8fafc',
        }}
      >
        {/* 상단 헤더 */}
        <header
          style={{
            flexShrink: 0,
            height: isMobile ? '52px' : '64px',
            backgroundColor: '#fff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: isMobile ? '0 12px' : '0 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bot size={22} />
            <div>
              <h1 style={{ fontSize: '17px', fontWeight: 700, color: '#1a202c', margin: 0 }}>
                AI 업무 어시스턴트
              </h1>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                {user?.name ? `${user.name} (${user.role})` : '내부 업무 보조'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => router.push(isMobile ? '/mobile' : '/admin/dashboard')}
              style={{
                padding: '9px 16px',
                backgroundColor: '#1a202c',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isMobile ? (<><ArrowLeft size={14} /> 메뉴</>) : (<><FolderOpen size={14} /> 관리자 화면</>)}
            </button>
            <button
              onClick={logout}
              style={{
                padding: '9px 14px',
                backgroundColor: '#fff',
                color: '#ef4444',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              로그아웃
            </button>
          </div>
        </header>

        {/* 챗 영역 */}
        <main style={{ flex: 1, minHeight: 0, padding: isMobile ? '8px' : '16px' }}>
          <ChatAssistant />
        </main>
      </div>
    </AdminRoute>
  );
}
