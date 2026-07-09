'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';
import { Bot, Megaphone, Calendar, MessageCircle, Menu } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  roles?: string[];
  excludeRoles?: string[];
  badgeKey?: 'messages' | 'announcements';
}

export function MobileNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [unread, setUnread] = useState<{ messages: number; announcements: number }>({ messages: 0, announcements: 0 });

  // 업무관리 셸 네비게이션 (교환권 도구는 '더보기'로 이동)
  const navItems: NavItem[] = [
    { id: 'home', label: 'AI', icon: Bot, path: '/mobile' },
    { id: 'notices', label: '공지', icon: Megaphone, path: '/mobile/notices', badgeKey: 'announcements' },
    { id: 'schedule', label: '일정', icon: Calendar, path: '/mobile/schedule' },
    { id: 'messages', label: '쪽지', icon: MessageCircle, path: '/mobile/messages', badgeKey: 'messages' },
    { id: 'more', label: '더보기', icon: Menu, path: '/mobile/more' },
  ];

  const refreshUnread = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await getSupabaseClient().rpc('unread_counts');
      if (!error && data) {
        setUnread({ messages: (data as any).messages || 0, announcements: (data as any).announcements || 0 });
      }
    } catch {
      // 무시
    }
  }, [user?.id]);

  useEffect(() => {
    refreshUnread();
  }, [refreshUnread, pathname]);

  useEffect(() => {
    if (!user?.id) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('mobile-unread-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => refreshUnread())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => refreshUnread())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_reads' }, () => refreshUnread())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshUnread]);

  const filteredNavItems = navItems.filter((item) => {
    if (item.roles && !item.roles.includes(user?.role || 'viewer')) return false;
    if (item.excludeRoles && item.excludeRoles.includes(user?.role || 'viewer')) return false;
    return true;
  });

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderTop: '1px solid #e5e7eb',
        paddingTop: '8px',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        zIndex: 1000,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          maxWidth: '500px',
          margin: '0 auto',
          padding: '0 8px',
        }}
      >
        {filteredNavItems.map((item) => {
          const isActive =
            pathname === item.path ||
            (item.path !== '/mobile' && pathname.startsWith(item.path));
          const badge = item.badgeKey ? unread[item.badgeKey] : 0;

          return (
            <button
              key={item.id}
              onClick={() => router.push(item.path)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 10px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: '56px',
                color: isActive ? '#3b82f6' : '#6b7280',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: '1',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 0.2s ease',
                }}
              >
                <item.icon size={24} />
              </span>
              <span style={{ fontSize: '12px', fontWeight: isActive ? 600 : 500, lineHeight: '1' }}>{item.label}</span>
              {badge > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '8px',
                    minWidth: '16px',
                    height: '16px',
                    padding: '0 4px',
                    borderRadius: '999px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
