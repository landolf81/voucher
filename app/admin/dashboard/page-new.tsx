'use client';

import React, { useState } from 'react';
import { useDevice } from '@/lib/hooks/useDevice';
import { AdminRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/contexts/AuthContext';

// Import organized components
import { OverviewContent } from '@/components/admin/dashboard/OverviewComponents';
import { VoucherManagement } from '@/components/admin/vouchers/VoucherManagement';
import { VoucherUsageContent } from '@/components/admin/vouchers/VoucherUsageContent';
import { VoucherInquiryContent } from '@/components/admin/vouchers/VoucherInquiryContent';
import { SiteManagement } from '@/components/admin/sites/SiteManagement';
import { UserManagement } from '@/components/admin/users/UserManagement';

type MenuType = 'overview' | 'vouchers' | 'usage' | 'inquiry' | 'users' | 'sites';

export default function AdminDashboard() {
  const device = useDevice();
  const { user, logout } = useAuth();
  const [currentMenu, setCurrentMenu] = useState<MenuType>('overview');

  // 권한에 따른 메뉴 필터링
  const getMenuItems = () => {
    const allItems = [
      { id: 'overview', label: '대시보드', icon: '📊', roles: ['admin', 'staff', 'viewer'] },
      { id: 'vouchers', label: '교환권 관리', icon: '🎫', roles: ['admin', 'staff'] },
      { id: 'usage', label: '교환권 사용 등록', icon: '✅', roles: ['admin', 'staff', 'viewer'] },
      { id: 'inquiry', label: '교환권 조회', icon: '🔍', roles: ['admin', 'staff', 'viewer'] },
      { id: 'sites', label: '사업장 관리', icon: '🏢', roles: ['admin', 'staff'] },
      { id: 'users', label: '사용자 관리', icon: '👥', roles: ['admin'] },
    ];
    
    return allItems.filter(item => 
      item.roles.includes(user?.role || 'viewer')
    );
  };

  const menuItems = getMenuItems();

  const renderContent = () => {
    switch (currentMenu) {
      case 'overview':
        return <OverviewContent />;
      case 'vouchers':
        return <VoucherManagement />;
      case 'usage':
        return <VoucherUsageContent />;
      case 'inquiry':
        return <VoucherInquiryContent />;
      case 'sites':
        return <SiteManagement />;
      case 'users':
        return <UserManagement />;
      default:
        return <OverviewContent />;
    }
  };

  return (
    <AdminRoute>
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex'
      }}>
        {/* 사이드바 */}
        <aside style={{
          width: device.isMobile ? '100%' : '280px',
          backgroundColor: 'white',
          borderRight: '1px solid #e2e8f0',
          boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
          position: device.isMobile ? 'fixed' : 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 1000,
          overflowY: 'auto'
        }}>
          {/* 헤더 */}
          <div style={{
            padding: '24px',
            borderBottom: '1px solid #e2e8f0'
          }}>
            <h1 style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#1a202c',
              margin: 0
            }}>
              관리자 패널
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#64748b',
              margin: '4px 0 0 0'
            }}>
              {user?.name} ({user?.role})
            </p>
          </div>

          {/* 메뉴 */}
          <nav style={{ padding: '16px' }}>
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentMenu(item.id as MenuType)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  marginBottom: '8px',
                  backgroundColor: currentMenu === item.id ? '#3b82f6' : 'transparent',
                  color: currentMenu === item.id ? 'white' : '#64748b',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: currentMenu === item.id ? '600' : '500',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentMenu !== item.id) {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentMenu !== item.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span style={{ fontSize: '20px' }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* 로그아웃 */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '16px',
            right: '16px'
          }}>
            <button
              onClick={logout}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>🚪</span>
              로그아웃
            </button>
          </div>
        </aside>

        {/* 메인 컨텐츠 */}
        <main style={{
          flex: 1,
          padding: device.isMobile ? '20px' : '0',
          marginLeft: device.isMobile ? 0 : '0',
          overflow: 'auto'
        }}>
          {renderContent()}
        </main>
      </div>
    </AdminRoute>
  );
}