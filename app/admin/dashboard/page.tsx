'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { MemberManagement } from '@/components/admin/members/MemberManagement';
import { AssociationManagement } from '@/components/admin/associations/AssociationManagement';
import { ScheduleCalendar } from '@/components/admin/schedule/ScheduleCalendar';

type MenuType = 'overview' | 'vouchers' | 'usage' | 'inquiry' | 'users' | 'sites' | 'members' | 'associations' | 'schedule';

export default function AdminDashboard() {
  const device = useDevice();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [currentMenu, setCurrentMenu] = useState<MenuType>('overview');

  // 권한에 따른 메뉴 필터링
  const getMenuItems = () => {
    const allItems = [
      { id: 'overview', label: '대시보드', icon: '📊', roles: ['admin', 'staff', 'viewer'] },
      { id: 'schedule', label: '일정', icon: '📅', roles: ['admin', 'staff', 'viewer'] },
      { id: 'vouchers', label: '교환권 관리', icon: '🎫', roles: ['admin', 'staff'] },
      { id: 'usage', label: '교환권 사용 등록', icon: '✅', roles: ['admin', 'staff', 'viewer'] },
      { id: 'inquiry', label: '교환권 조회', icon: '🔍', roles: ['admin', 'staff', 'viewer'] },
      { id: 'members', label: '조합원 관리', icon: '👤', roles: ['admin'] },
      { id: 'associations', label: '영농회 관리', icon: '🌾', roles: ['admin'] },
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
      case 'schedule':
        return <ScheduleCalendar />;
      case 'vouchers':
        return <VoucherManagement />;
      case 'usage':
        return <VoucherUsageContent />;
      case 'inquiry':
        return <VoucherInquiryContent />;
      case 'members':
        return <MemberManagement />;
      case 'associations':
        return <AssociationManagement />;
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
          position: 'fixed',
          top: 0,
          left: 0,
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
            <button
              onClick={() => router.push('/chat')}
              style={{
                marginTop: '16px',
                width: '100%',
                padding: '12px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              🤖 AI 챗봇으로
            </button>
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
          position: 'fixed',
          top: 0,
          left: device.isMobile ? 0 : '280px',
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f8fafc',
          overflow: 'hidden'
        }}>
          {/* 본문 헤더 */}
          <div style={{
            backgroundColor: 'white',
            borderBottom: '1px solid #e2e8f0',
            padding: '24px 32px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            zIndex: 100,
            flexShrink: 0
          }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#1a202c',
              margin: 0
            }}>
              {menuItems.find(item => item.id === currentMenu)?.icon} {menuItems.find(item => item.id === currentMenu)?.label || '대시보드'}
            </h2>
          </div>
          
          {/* 스크롤 가능한 컨텐츠 영역 */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: device.isMobile ? '20px' : '32px'
          }}>
            {renderContent()}
          </div>
        </main>
      </div>
    </AdminRoute>
  );
}