'use client';

/**
 * 디바이스별 네비게이션 컴포넌트
 */

import React from 'react';
import { useDevice } from '@/lib/hooks/useDevice';
import { useAuth } from '@/lib/contexts/AuthContext';
import { getMenuItems } from '@/lib/auth/permissions';

export function Navigation() {
  const device = useDevice();
  const { user, logout } = useAuth();

  if (!user) return null;

  const menuItems = getMenuItems(user.role);

  if (device.isMobile) {
    return <MobileNavigation menuItems={menuItems} user={user} logout={logout} />;
  } else {
    return <DesktopNavigation menuItems={menuItems} user={user} logout={logout} />;
  }
}

// 모바일 네비게이션 (하단 고정)
function MobileNavigation({ menuItems, user, logout }: any) {
  return (
    <>
      {/* 상단 헤더 */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '60px',
        backgroundColor: '#fff',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 1000,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#333',
          margin: 0
        }}>
          교환권 시스템
        </h1>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{
            fontSize: '14px',
            color: '#666'
          }}>
            {user.name}
          </span>
          <button
            onClick={logout}
            style={{
              padding: '6px 12px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 하단 네비게이션 */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '70px',
        backgroundColor: '#fff',
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        zIndex: 1000,
        boxShadow: '0 -2px 4px rgba(0,0,0,0.1)'
      }}>
        {menuItems.slice(0, 4).map((item: any) => (
          <a
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              color: '#666',
              fontSize: '12px',
              gap: '4px'
            }}
          >
            <span style={{ fontSize: '20px' }}>{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </div>

      {/* 컨텐츠 영역 여백 */}
      <div style={{ paddingTop: '60px', paddingBottom: '70px' }}>
        {/* 페이지 컨텐츠가 여기에 들어감 */}
      </div>
    </>
  );
}

// 데스크톱 네비게이션 (사이드바)
function DesktopNavigation({ menuItems, user, logout }: any) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '250px',
      height: '100vh',
      backgroundColor: '#fff',
      borderRight: '1px solid #e0e0e0',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      boxShadow: '2px 0 4px rgba(0,0,0,0.1)'
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <h1 style={{
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#333',
          margin: '0 0 8px 0'
        }}>
          교환권 시스템
        </h1>
        <div style={{
          fontSize: '14px',
          color: '#666'
        }}>
          {user.name} ({user.role === 'admin' ? '관리자' : '직원'})
        </div>
      </div>

      {/* 메뉴 */}
      <div style={{ flex: 1, padding: '16px 0' }}>
        {menuItems.map((item: any) => (
          <a
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 20px',
              textDecoration: 'none',
              color: '#333',
              fontSize: '16px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span style={{ fontSize: '20px' }}>{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </div>

      {/* 로그아웃 */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid #e0e0e0'
      }}>
        <button
          onClick={logout}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#e9ecef';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
          }}
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}