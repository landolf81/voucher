'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDevice } from '@/lib/hooks/useDevice';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const device = useDevice();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    // 로딩 중이면 대기
    if (isLoading) return;
    
    // 사용자가 로그인된 경우
    if (user) {
      if (device.isMobile) {
        // 모바일에서는 모바일 전용 페이지로
        router.replace('/mobile');
      } else {
        // 데스크탑에서는 관리자 대시보드로
        router.replace('/admin/dashboard');
      }
    } else {
      // 로그인되지 않은 경우 로그인 페이지로
      router.replace('/login');
    }
  }, [router, device.isMobile, user, isLoading]);

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
