'use client';

import React from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useDevice } from '@/lib/hooks/useDevice';
import { MobileLayout } from '@/components/mobile/MobileLayout';

export default function MobilePage() {
  const { user, isLoading } = useAuth();
  const device = useDevice();

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
          <p style={{ color: '#6b7280' }}>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8fafc',
        padding: '20px'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '16px'
        }}>
          🔐
        </div>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#1f2937',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          로그인이 필요합니다
        </h2>
        <p style={{
          color: '#6b7280',
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          교환권 시스템을 사용하려면 로그인해주세요
        </p>
        <button
          onClick={() => window.location.href = '/login'}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          로그인 페이지로 이동
        </button>
      </div>
    );
  }

  return (
    <MobileLayout>
      <div style={{
        padding: '20px',
        paddingBottom: '100px' // 하단 네비게이션 공간 확보
      }}>
        {/* 환영 섹션 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>👋</div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '4px'
          }}>
            안녕하세요, {user.name}님
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: '16px'
          }}>
            {user.site_name} • {user.role === 'admin' ? '관리자' : user.role === 'staff' ? '직원' : '뷰어'}
          </p>
        </div>

        {/* 빠른 액션 버튼들 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => window.location.href = '/mobile/scan'}
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '16px',
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              minHeight: '120px',
              justifyContent: 'center'
            }}
          >
            <span style={{ fontSize: '32px' }}>📱</span>
            <span>QR 스캔</span>
            <span style={{ fontSize: '12px', opacity: 0.9 }}>교환권 사용등록</span>
          </button>

          <button
            onClick={() => window.location.href = '/mobile/search'}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '16px',
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              minHeight: '120px',
              justifyContent: 'center'
            }}
          >
            <span style={{ fontSize: '32px' }}>🔍</span>
            <span>교환권 조회</span>
            <span style={{ fontSize: '12px', opacity: 0.9 }}>상태 확인</span>
          </button>
        </div>

        {/* 최근 활동 또는 통계 (추후 구현) */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '16px'
          }}>
            📊 오늘의 활동
          </h2>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100px',
            color: '#6b7280'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📈</div>
              <p>통계 기능 준비 중입니다</p>
            </div>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}

// CSS 애니메이션 추가
const styles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}