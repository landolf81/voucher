'use client';

import React from 'react';

interface Statistics {
  total_count: number;
  total_amount: number;
  registered_count: number;
  registered_amount: number;
  issued_count: number;
  issued_amount: number;
  used_count: number;
  used_amount: number;
  recalled_count: number;
  recalled_amount: number;
  disposed_count: number;
  disposed_amount: number;
}

interface Props {
  statistics: Statistics;
}

// 순수 포맷 헬퍼 — 컴포넌트 밖(모듈 스코프)에 두어 매 렌더마다 재생성되지 않게 함
const formatAmount = (amount: number) => amount.toLocaleString('ko-KR') + '원';
const formatCount = (count: number) => count.toLocaleString('ko-KR') + '건';
const calculatePercentage = (count: number, total: number) => {
  if (total === 0) return '0';
  return ((count / total) * 100).toFixed(1);
};

// 상태별 통계 카드 — 렌더 안에서 정의하면 매 렌더마다 새 컴포넌트 타입이 되어
// 불필요한 언마운트/리마운트가 생기므로 모듈 스코프로 분리. total 은 prop 으로 전달.
function StatCard({
  title,
  count,
  amount,
  color,
  total,
}: {
  title: string;
  count: number;
  amount: number;
  color: string;
  bgColor: string;
  total: number;
}) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{
        fontSize: '14px',
        color: '#6b7280',
        marginBottom: '8px',
        fontWeight: '500'
      }}>
        {title}
      </div>
      <div style={{
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#1a202c',
        marginBottom: '4px'
      }}>
        {formatCount(count)}
      </div>
      <div style={{
        fontSize: '16px',
        color: color,
        fontWeight: '500'
      }}>
        {formatAmount(amount)}
      </div>
      <div style={{
        marginTop: '8px',
        fontSize: '12px',
        color: '#9ca3af'
      }}>
        전체 대비 {calculatePercentage(count, total)}%
      </div>
    </div>
  );
}

export function VoucherStatistics({ statistics }: Props) {
  return (
    <div style={{ marginBottom: '24px' }}>
      {/* 전체 요약 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '16px'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#1a202c',
          marginBottom: '16px'
        }}>
          전체 현황
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '24px'
        }}>
          <div>
            <div style={{
              fontSize: '14px',
              color: '#6b7280',
              marginBottom: '8px'
            }}>
              총 발행 건수
            </div>
            <div style={{
              fontSize: '32px',
              fontWeight: 'bold',
              color: '#1a202c'
            }}>
              {formatCount(statistics.total_count)}
            </div>
          </div>
          
          <div>
            <div style={{
              fontSize: '14px',
              color: '#6b7280',
              marginBottom: '8px'
            }}>
              총 발행 금액
            </div>
            <div style={{
              fontSize: '32px',
              fontWeight: 'bold',
              color: '#1a202c'
            }}>
              {formatAmount(statistics.total_amount)}
            </div>
          </div>
        </div>

        {/* 사용률 진행바 */}
        <div style={{ marginTop: '24px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>사용률</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#1a202c' }}>
              {calculatePercentage(statistics.used_count, statistics.total_count)}%
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '12px',
            backgroundColor: '#e5e7eb',
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${calculatePercentage(statistics.used_count, statistics.total_count)}%`,
              height: '100%',
              backgroundColor: '#3b82f6',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      </div>

      {/* 상태별 통계 카드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '16px'
      }}>
        <StatCard
          title="등록됨"
          count={statistics.registered_count}
          amount={statistics.registered_amount}
          color="#6b7280"
          bgColor="#f3f4f6"
          total={statistics.total_count}
        />
        <StatCard
          title="발행됨"
          count={statistics.issued_count}
          amount={statistics.issued_amount}
          color="#16a34a"
          bgColor="#dcfce7"
          total={statistics.total_count}
        />
        <StatCard
          title="사용됨"
          count={statistics.used_count}
          amount={statistics.used_amount}
          color="#d97706"
          bgColor="#fef3c7"
          total={statistics.total_count}
        />
        <StatCard
          title="회수됨"
          count={statistics.recalled_count}
          amount={statistics.recalled_amount}
          color="#2563eb"
          bgColor="#dbeafe"
          total={statistics.total_count}
        />
        <StatCard
          title="폐기됨"
          count={statistics.disposed_count}
          amount={statistics.disposed_amount}
          color="#dc2626"
          bgColor="#fee2e2"
          total={statistics.total_count}
        />
      </div>
    </div>
  );
}