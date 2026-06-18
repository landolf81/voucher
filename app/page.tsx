'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    // 로딩 중이면 대기
    if (isLoading) return;
    
    // 사용자가 로그인된 경우
    if (user) {
      // 데스크탑·모바일 모두 기본 진입은 메인 화면(AI 챗봇)
      // (모바일 스캔/메뉴는 챗 헤더의 "← 메뉴"로, 데스크탑 관리 기능은 /admin/dashboard)
      router.replace('/chat');
    } else {
      // 로그인되지 않은 경우 로그인 페이지로
      router.replace('/login');
    }
  }, [router, user, isLoading]);

  // 로딩 상태 표시
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#6b7280' }}>시스템 로딩 중...</p>
        </div>
      </div>
    );
  }

  return null;
}

// CSS 애니메이션 추가
if (typeof document !== 'undefined') {
  const styles = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  
  const styleSheet = document.createElement('style');
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}
