'use client';

import React, { useState, useEffect } from 'react';
import { ActivityFeed } from './ActivityFeed';

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


// Dashboard Overview Content
export function OverviewContent() {
  const [stats, setStats] = useState<{
    totalVouchers: number;
    usedVouchers: number;
    unusedVouchers: number;
    totalSites: number;
    totalUsers: number;
    todayIssued: number;
    usageRate: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 통계 데이터 가져오기
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/dashboard/stats');
        const result = await response.json();

        if (result.ok) {
          setStats(result.data);
        } else {
          setError(result.message || '통계를 불러올 수 없습니다.');
        }
      } catch (error) {
        console.error('통계 조회 오류:', error);
        setError('통계를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    
    // 30초마다 자동 새로고침 (선택사항)
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // 숫자 포맷팅 함수
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
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
        {loading ? (
          // 로딩 상태
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{
                  height: '20px',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '4px',
                  marginBottom: '16px',
                  width: '60%'
                }} />
                <div style={{
                  height: '32px',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '4px',
                  width: '40%'
                }} />
              </div>
            ))}
          </>
        ) : error ? (
          // 에러 상태
          <div style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '40px',
            backgroundColor: '#fee2e2',
            borderRadius: '12px',
            color: '#991b1b'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <p>{error}</p>
          </div>
        ) : stats ? (
          // 실제 데이터 표시
          <>
            <StatCard
              title="발급된 교환권"
              value={formatNumber(stats.totalVouchers)}
              icon="🎫"
              color="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            />
            <StatCard
              title="사용된 교환권"
              value={formatNumber(stats.usedVouchers)}
              icon="✅"
              color="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
            />
            <StatCard
              title="등록된 사업장"
              value={formatNumber(stats.totalSites)}
              icon="🏢"
              color="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
            />
            <StatCard
              title="활성 사용자"
              value={formatNumber(stats.totalUsers)}
              icon="👥"
              color="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
            />
          </>
        ) : null}
      </div>


      {/* 실시간 활동 피드 */}
      <div style={{ marginTop: '40px' }}>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#1a202c',
          marginBottom: '24px'
        }}>
          최근 활동
        </h3>
        <ActivityFeed />
      </div>
    </div>
  );
}