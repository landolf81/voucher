'use client';

import React from 'react';

// Shared UI Components
export function StatCard({ title, value, icon, color }: {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      border: '1px solid #e2e8f0'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px'
      }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: '500',
          color: '#64748b',
          margin: 0
        }}>
          {title}
        </h3>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          backgroundColor: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px'
        }}>
          {icon}
        </div>
      </div>
      <p style={{
        fontSize: '28px',
        fontWeight: 'bold',
        color: '#1a202c',
        margin: 0
      }}>
        {value}
      </p>
    </div>
  );
}

export function QuickActionButton({ title, description, icon, color }: {
  title: string;
  description: string;
  icon: string;
  color: string;
}) {
  return (
    <button style={{
      backgroundColor: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '20px',
      width: '100%',
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      transition: 'all 0.2s'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '10px',
          backgroundColor: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          flexShrink: 0
        }}>
          {icon}
        </div>
        <div style={{ textAlign: 'left', flex: 1 }}>
          <h4 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1a202c',
            margin: '0 0 4px 0'
          }}>
            {title}
          </h4>
          <p style={{
            fontSize: '14px',
            color: '#64748b',
            margin: 0,
            lineHeight: '1.4'
          }}>
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

// Dashboard Overview Content
export function OverviewContent() {
  return (
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#1a202c',
          margin: '0 0 8px 0'
        }}>
          대시보드
        </h2>
        <p style={{
          fontSize: '16px',
          color: '#64748b',
          margin: 0
        }}>
          시스템 전체 현황을 확인하고 주요 작업을 수행할 수 있습니다.
        </p>
      </div>

      {/* 통계 카드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '24px',
        marginBottom: '40px'
      }}>
        <StatCard
          title="발급된 교환권"
          value="1,234"
          icon="🎫"
          color="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
        />
        <StatCard
          title="사용된 교환권"
          value="856"
          icon="✅"
          color="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
        />
        <StatCard
          title="등록된 사업장"
          value="12"
          icon="🏢"
          color="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
        />
        <StatCard
          title="활성 사용자"
          value="45"
          icon="👥"
          color="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
        />
      </div>

      {/* 빠른 작업 */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#1a202c',
          margin: '0 0 20px 0'
        }}>
          빠른 작업
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px'
        }}>
          <QuickActionButton
            title="교환권 발급"
            description="새로운 교환권을 발급합니다"
            icon="➕"
            color="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          />
          <QuickActionButton
            title="사용 등록"
            description="교환권 사용을 등록합니다"
            icon="✍️"
            color="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
          />
          <QuickActionButton
            title="교환권 조회"
            description="교환권 정보를 조회합니다"
            icon="🔍"
            color="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
          />
          <QuickActionButton
            title="사용자 관리"
            description="시스템 사용자를 관리합니다"
            icon="⚙️"
            color="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
          />
        </div>
      </div>
    </div>
  );
}