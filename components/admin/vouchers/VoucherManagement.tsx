'use client';

import React, { useState } from 'react';
import { VoucherTemplateForm } from './VoucherTemplateForm';
import { VoucherRecipientsForm } from './VoucherRecipientsForm';
import { VoucherIssueForm } from './VoucherIssueForm';
import { VoucherRetrieveForm } from './VoucherRetrieveForm';
import { VoucherDesignManager } from './VoucherDesignManager';
import { MobileVoucherManagement } from './MobileVoucherManagement';
import { MobileTemplateManager } from './MobileTemplateManager';
import { useAuth } from '@/lib/contexts/AuthContext';

type VoucherTab = 'template' | 'recipients' | 'design' | 'issue' | 'mobile' | 'mobile-design' | 'retrieve';

export function VoucherManagement() {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<VoucherTab>('template');

  // 권한에 따른 탭 필터링
  const getAllTabs = () => [
    { id: 'template', label: '교환권 정보', icon: '📝', roles: ['admin', 'staff'] },
    { id: 'recipients', label: '발행대상 등록', icon: '👥', roles: ['admin', 'staff'] },
    { id: 'design', label: '디자인 관리', icon: '🎨', roles: ['admin', 'staff'] },
    { id: 'issue', label: '발행(인쇄)', icon: '🖨️', roles: ['admin', 'staff'] },
    { id: 'mobile', label: '모바일 발행', icon: '📱', roles: ['admin', 'staff'] },
    { id: 'mobile-design', label: '모바일 디자인', icon: '🎨', roles: ['admin', 'staff'] },
    { id: 'retrieve', label: '회수', icon: '🔄', roles: ['admin'] }, // 관리자 전용
  ];

  const tabs = getAllTabs().filter(tab => 
    tab.roles.includes(user?.role || 'viewer')
  );

  return (
    <div>
      <h2 style={{
        fontSize: '28px',
        fontWeight: 'bold',
        color: '#1a202c',
        marginBottom: '24px'
      }}>
        교환권 관리
      </h2>

      {/* 탭 메뉴 */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '1px solid #e2e8f0'
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCurrentTab(tab.id as VoucherTab)}
            style={{
              padding: '12px 20px',
              backgroundColor: 'transparent',
              color: currentTab === tab.id ? '#3b82f6' : '#64748b',
              border: 'none',
              borderBottom: currentTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ marginRight: '8px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        minHeight: '500px'
      }}>
        {currentTab === 'template' && <VoucherTemplateForm />}
        {currentTab === 'recipients' && <VoucherRecipientsForm />}
        {currentTab === 'design' && <VoucherDesignManager />}
        {currentTab === 'issue' && <VoucherIssueForm />}
        {currentTab === 'mobile' && <MobileVoucherManagement />}
        {currentTab === 'mobile-design' && <MobileTemplateManager />}
        {currentTab === 'retrieve' && user?.role === 'admin' && <VoucherRetrieveForm />}
        {currentTab === 'retrieve' && user?.role !== 'admin' && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
              접근 권한이 없습니다
            </h3>
            <p>교환권 회수 기능은 관리자만 사용할 수 있습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}