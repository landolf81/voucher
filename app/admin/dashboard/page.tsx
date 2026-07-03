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
import { MessagesPanel } from '@/components/admin/messages/MessagesPanel';
import { AnnouncementsPanel } from '@/components/admin/announcements/AnnouncementsPanel';
import { AppraisalsPanel } from '@/components/admin/appraisals/AppraisalsPanel';
import { getSupabaseClient } from '@/lib/supabase';

type MenuType = 'overview' | 'vouchers' | 'usage' | 'inquiry' | 'users' | 'sites' | 'members' | 'associations' | 'schedule' | 'messages' | 'notices' | 'appraisals';

interface MenuNode {
  id: string;
  label: string;
  icon: string;
  roles: string[];
  badge: number;
  children?: MenuNode[];
}

export default function AdminDashboard() {
  const device = useDevice();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [currentMenu, setCurrentMenu] = useState<MenuType>('overview');
  const [unread, setUnread] = useState<{ messages: number; announcements: number; appraisals: number }>({ messages: 0, announcements: 0, appraisals: 0 });
  const [voucherOpen, setVoucherOpen] = useState(true);

  // 안읽음 카운트 (헤더/메뉴 뱃지)
  const refreshUnread = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await getSupabaseClient().rpc('unread_counts');
      if (!error && data) {
        setUnread({ messages: (data as any).messages || 0, announcements: (data as any).announcements || 0, appraisals: (data as any).appraisals || 0 });
      }
    } catch {
      // 무시
    }
  }, [user?.id]);

  React.useEffect(() => {
    refreshUnread();
  }, [refreshUnread, currentMenu]);

  React.useEffect(() => {
    if (!user?.id) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('unread-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => refreshUnread())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => refreshUnread())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_reads' }, () => refreshUnread())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appraisals' }, () => refreshUnread())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appraisal_reads' }, () => refreshUnread())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshUnread]);

  // 권한에 따른 메뉴 필터링 (교환권 업무는 '교환권' 그룹 아래로 묶음)
  const getMenuItems = (): MenuNode[] => {
    const role = user?.role || 'viewer';
    const has = (roles: string[]) => roles.includes(role);

    const voucherChildren: MenuNode[] = [
      { id: 'vouchers', label: '발행·관리', icon: '🎫', roles: ['admin', 'staff'], badge: 0 },
      { id: 'usage', label: '사용 등록', icon: '✅', roles: ['admin', 'staff', 'viewer'], badge: 0 },
      { id: 'inquiry', label: '조회', icon: '🔍', roles: ['admin', 'staff', 'viewer'], badge: 0 },
    ].filter((c) => has(c.roles));

    const tree: MenuNode[] = [
      { id: 'overview', label: '대시보드', icon: '📊', roles: ['admin', 'staff', 'viewer'], badge: 0 },
      { id: 'schedule', label: '일정', icon: '📅', roles: ['admin', 'staff', 'viewer'], badge: 0 },
      { id: 'notices', label: '공지', icon: '📢', roles: ['admin', 'staff', 'viewer', 'part_time', 'inquiry'], badge: unread.announcements },
      { id: 'messages', label: '쪽지', icon: '💬', roles: ['admin', 'staff', 'viewer', 'part_time', 'inquiry'], badge: unread.messages },
      { id: 'appraisals', label: '감정평가', icon: '🏠', roles: ['admin', 'staff', 'viewer', 'part_time', 'inquiry'], badge: unread.appraisals },
      { id: 'voucher-group', label: '교환권', icon: '🎟️', roles: ['admin', 'staff', 'viewer'], badge: 0, children: voucherChildren },
      { id: 'members', label: '조합원 관리', icon: '👤', roles: ['admin'], badge: 0 },
      { id: 'associations', label: '영농회 관리', icon: '🌾', roles: ['admin'], badge: 0 },
      { id: 'sites', label: '사업장 관리', icon: '🏢', roles: ['admin', 'staff'], badge: 0 },
      { id: 'users', label: '사용자 관리', icon: '👥', roles: ['admin'], badge: 0 },
    ];

    return tree.filter((item) => (item.children ? item.children.length > 0 : has(item.roles)));
  };

  const menuItems = getMenuItems();

  // 트리 평탄화 (본문 헤더 제목 조회용)
  const activeNode = menuItems
    .flatMap((i) => (i.children ? [i, ...i.children] : [i]))
    .find((n) => n.id === currentMenu);

  // 메뉴 버튼 스타일/렌더 헬퍼
  const menuBtnStyle = (active: boolean, isChild = false): React.CSSProperties => ({
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: isChild ? '12px 16px 12px 32px' : '16px',
    marginBottom: '6px',
    backgroundColor: active ? '#3b82f6' : 'transparent',
    color: active ? 'white' : '#64748b',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: isChild ? '15px' : '16px',
    fontWeight: active ? 600 : 500,
    transition: 'all 0.2s',
  });

  const renderLeaf = (item: MenuNode, isChild = false) => (
    <button
      key={item.id}
      onClick={() => setCurrentMenu(item.id as MenuType)}
      style={menuBtnStyle(currentMenu === item.id, isChild)}
      onMouseEnter={(e) => { if (currentMenu !== item.id) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
      onMouseLeave={(e) => { if (currentMenu !== item.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <span style={{ fontSize: isChild ? '16px' : '20px' }}>{item.icon}</span>
      <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
      {item.badge > 0 && (
        <span style={{ minWidth: '20px', height: '20px', padding: '0 6px', borderRadius: '999px', backgroundColor: currentMenu === item.id ? 'white' : '#ef4444', color: currentMenu === item.id ? '#3b82f6' : 'white', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </button>
  );

  const renderContent = () => {
    switch (currentMenu) {
      case 'overview':
        return <OverviewContent />;
      case 'schedule':
        return <ScheduleCalendar />;
      case 'messages':
        return <MessagesPanel />;
      case 'notices':
        return <AnnouncementsPanel />;
      case 'appraisals':
        return <AppraisalsPanel />;
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
            {menuItems.map((item) =>
              item.children ? (
                <div key={item.id}>
                  <button
                    onClick={() => setVoucherOpen((v) => !v)}
                    style={menuBtnStyle(false)}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <span style={{ fontSize: '20px' }}>{item.icon}</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>{voucherOpen ? '▲' : '▼'}</span>
                  </button>
                  {voucherOpen && item.children.map((c) => renderLeaf(c, true))}
                </div>
              ) : (
                renderLeaf(item)
              )
            )}
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
              {activeNode?.icon} {activeNode?.label || '대시보드'}
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