'use client';

/**
 * 더보기 — 교환권 도구(스캔/조회/출력) 및 계정.
 * 업무관리 개편으로 교환권 업무는 이 화면 아래로 후순위 배치.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { MobileShell } from '@/components/mobile/MobileShell';
import { useAuth } from '@/lib/contexts/AuthContext';

interface MoreItem {
  label: string;
  desc: string;
  icon: string;
  path: string;
  show: boolean;
}

export default function MobileMorePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const role = user?.role || 'viewer';

  const items: MoreItem[] = [
    { label: 'QR 스캔', desc: '교환권 사용등록', icon: '📱', path: '/mobile/scan', show: role !== 'inquiry' },
    { label: '교환권 조회', desc: '상태 확인', icon: '🔍', path: '/mobile/search', show: true },
    { label: '사용 내역 출력', desc: '보고서', icon: '📄', path: '/mobile/report', show: ['admin', 'staff'].includes(role) },
  ].filter((i) => i.show);

  return (
    <MobileShell title="☰ 더보기">
      <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* 사용자 카드 */}
        <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>{user?.name}</div>
          <div style={{ color: '#6b7280', fontSize: '14px', marginTop: '2px' }}>
            {user?.site_name ? `${user.site_name} · ` : ''}
            {role === 'admin' ? '관리자' : role === 'staff' ? '직원' : role === 'viewer' ? '뷰어' : role}
          </div>
        </div>

        {/* 교환권 도구 */}
        <div style={{ color: '#9ca3af', fontSize: '12px', fontWeight: 600, padding: '0 4px' }}>교환권 업무</div>
        {items.map((item) => (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              backgroundColor: 'white',
              border: '1px solid #f1f5f9',
              borderRadius: '14px',
              padding: '16px 18px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '26px' }}>{item.icon}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>{item.label}</span>
              <span style={{ display: 'block', fontSize: '13px', color: '#9ca3af' }}>{item.desc}</span>
            </span>
            <span style={{ color: '#cbd5e1' }}>›</span>
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <button
          onClick={logout}
          style={{
            backgroundColor: 'white',
            color: '#ef4444',
            border: '1px solid #fecaca',
            borderRadius: '14px',
            padding: '14px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🚪 로그아웃
        </button>
      </div>
    </MobileShell>
  );
}
