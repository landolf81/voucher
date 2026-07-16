'use client';

/**
 * 더보기 — 교환권 업무(드롭다운) + 업무/관리 메뉴 및 계정.
 * 교환권 업무는 하나의 드롭다운으로 묶고, 데스크톱 대시보드의 나머지 메뉴를 노출.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileShell } from '@/components/mobile/MobileShell';
import { useAuth } from '@/lib/contexts/AuthContext';
import {
  Smartphone,
  Search,
  FileText,
  LogOut,
  Menu,
  Tickets,
  ChevronDown,
  ChevronUp,
  Home,
  User,
  Wheat,
  Building2,
  Users,
  MessageSquareWarning,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface MoreItem {
  label: string;
  desc: string;
  icon: LucideIcon;
  path: string;
  show: boolean;
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  backgroundColor: 'white',
  border: '1px solid #f1f5f9',
  borderRadius: '14px',
  padding: '16px 18px',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
};

const sectionLabelStyle: React.CSSProperties = {
  color: '#9ca3af',
  fontSize: '12px',
  fontWeight: 600,
  padding: '0 4px',
};

export default function MobileMorePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const role = user?.role || 'viewer';
  const [voucherOpen, setVoucherOpen] = useState(false);

  // 교환권 업무 (드롭다운으로 묶음)
  const voucherItems: MoreItem[] = [
    { label: 'QR 스캔', desc: '교환권 사용등록', icon: Smartphone, path: '/mobile/scan', show: role !== 'inquiry' },
    { label: '교환권 조회', desc: '상태 확인', icon: Search, path: '/mobile/search', show: true },
    { label: '사용 내역 출력', desc: '보고서', icon: FileText, path: '/mobile/report', show: ['admin', 'staff'].includes(role) },
  ].filter((i) => i.show);

  // 업무 메뉴 (데스크톱 대시보드와 동일한 권한)
  const workItems: MoreItem[] = [
    { label: '감정평가', desc: '평가서 기록·댓글', icon: Home, path: '/mobile/appraisals', show: true },
  ].filter((i) => i.show);

  // 관리 메뉴
  const adminItems: MoreItem[] = [
    { label: '조합원 관리', desc: '조합원 명부', icon: User, path: '/mobile/members', show: role === 'admin' },
    { label: '영농회 관리', desc: '영농회 명부', icon: Wheat, path: '/mobile/associations', show: role === 'admin' },
    { label: '사업장 관리', desc: '지점·매장', icon: Building2, path: '/mobile/sites', show: ['admin', 'staff'].includes(role) },
    { label: '사용자 관리', desc: '계정·권한', icon: Users, path: '/mobile/users', show: role === 'admin' },
    { label: '챗봇 피드백', desc: 'AI 응답 피드백', icon: MessageSquareWarning, path: '/mobile/chat-feedback', show: role === 'admin' },
  ].filter((i) => i.show);

  const renderItem = (item: MoreItem, isChild = false) => (
    <button
      key={item.path}
      onClick={() => router.push(item.path)}
      style={{
        ...cardStyle,
        ...(isChild
          ? { border: 'none', borderRadius: 0, padding: '13px 18px 13px 30px', borderTop: '1px solid #f1f5f9' }
          : {}),
      }}
    >
      <item.icon size={isChild ? 20 : 24} color={isChild ? '#64748b' : undefined} />
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: isChild ? '15px' : '16px', fontWeight: 600, color: '#1f2937' }}>{item.label}</span>
        <span style={{ display: 'block', fontSize: '13px', color: '#9ca3af' }}>{item.desc}</span>
      </span>
      <span style={{ color: '#cbd5e1' }}>›</span>
    </button>
  );

  return (
    <MobileShell title={<><Menu size={18} /> 더보기</>}>
      <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* 사용자 카드 */}
        <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>{user?.name}</div>
          <div style={{ color: '#6b7280', fontSize: '14px', marginTop: '2px' }}>
            {user?.site_name ? `${user.site_name} · ` : ''}
            {role === 'admin' ? '관리자' : role === 'staff' ? '직원' : role === 'viewer' ? '뷰어' : role}
          </div>
        </div>

        {/* 업무 */}
        <div style={sectionLabelStyle}>업무</div>

        {/* 교환권 업무 드롭다운 */}
        {voucherItems.length > 0 && (
          <div style={{ backgroundColor: 'white', border: '1px solid #f1f5f9', borderRadius: '14px', overflow: 'hidden' }}>
            <button onClick={() => setVoucherOpen((o) => !o)} style={{ ...cardStyle, border: 'none', borderRadius: 0 }}>
              <Tickets size={24} />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>교환권 업무</span>
                <span style={{ display: 'block', fontSize: '13px', color: '#9ca3af' }}>스캔 · 조회 · 출력</span>
              </span>
              {voucherOpen ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
            </button>
            {voucherOpen && voucherItems.map((item) => renderItem(item, true))}
          </div>
        )}

        {workItems.map((item) => renderItem(item))}

        {/* 관리 */}
        {adminItems.length > 0 && (
          <>
            <div style={sectionLabelStyle}>관리</div>
            {adminItems.map((item) => renderItem(item))}
          </>
        )}

        <div style={{ flex: 1, minHeight: '12px' }} />

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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <LogOut size={16} /> 로그아웃
        </button>
      </div>
    </MobileShell>
  );
}
