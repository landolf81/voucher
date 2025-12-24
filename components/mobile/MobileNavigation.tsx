'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  roles?: string[];
  excludeRoles?: string[];
}

export function MobileNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems: NavItem[] = [
    {
      id: 'home',
      label: '홈',
      icon: '🏠',
      path: '/mobile'
    },
    {
      id: 'scan',
      label: '스캔',
      icon: '📱',
      path: '/mobile/scan',
      excludeRoles: ['inquiry']
    },
    {
      id: 'search',
      label: '조회',
      icon: '🔍',
      path: '/mobile/search'
    },
    {
      id: 'report',
      label: '출력',
      icon: '📄',
      path: '/mobile/report',
      roles: ['admin', 'staff']
    }
  ];

  // 권한에 따른 네비게이션 아이템 필터링
  const filteredNavItems = navItems.filter(item => {
    // 필수 역할 확인
    if (item.roles && !item.roles.includes(user?.role || 'viewer')) return false;
    // 제외 역할 확인
    if (item.excludeRoles && item.excludeRoles.includes(user?.role || 'viewer')) return false;
    return true;
  });

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'white',
      borderTop: '1px solid #e5e7eb',
      paddingTop: '8px',
      paddingBottom: 'max(8px, env(safe-area-inset-bottom))', // iOS safe area 고려
      zIndex: 1000,
      boxShadow: '0 -2px 10px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        maxWidth: '500px',
        margin: '0 auto',
        padding: '0 16px'
      }}>
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.path || 
            (item.path === '/mobile' && pathname === '/mobile') ||
            (item.path.startsWith('/mobile/') && pathname.startsWith(item.path));

          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.path)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: '60px',
                color: isActive ? '#3b82f6' : '#6b7280'
              }}
              onTouchStart={(e) => {
                // 터치 피드백
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
              onTouchEnd={(e) => {
                // 터치 피드백 제거
                const target = e.currentTarget;
                setTimeout(() => {
                  if (target && target.style) {
                    target.style.backgroundColor = 'transparent';
                  }
                }, 150);
              }}
            >
              <span style={{
                fontSize: '24px',
                lineHeight: '1',
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 0.2s ease'
              }}>
                {item.icon}
              </span>
              <span style={{
                fontSize: '12px',
                fontWeight: isActive ? '600' : '500',
                lineHeight: '1'
              }}>
                {item.label}
              </span>
              {isActive && (
                <div style={{
                  width: '4px',
                  height: '4px',
                  backgroundColor: '#3b82f6',
                  borderRadius: '50%',
                  marginTop: '2px'
                }} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}