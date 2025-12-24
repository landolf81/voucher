'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useDevice } from '@/lib/hooks/useDevice';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface UsedVoucher {
  id: string;
  serial_no: string;
  amount: number;
  association: string;
  member_id: string;
  name: string;
  used_at: string;
  used_by: string;
  site_name: string;
}

export default function MobilePage() {
  const { user, isLoading } = useAuth();
  const device = useDevice();
  const [usedVouchers, setUsedVouchers] = useState<UsedVoucher[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // CSS 애니메이션 추가 (클라이언트 사이드에서만)
  useEffect(() => {
    const styleId = 'mobile-page-spin-animation';
    if (!document.getElementById(styleId)) {
      const styleSheet = document.createElement('style');
      styleSheet.id = styleId;
      styleSheet.innerText = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(styleSheet);
    }
  }, []);

  // 오늘 사용된 교환권 가져오기
  useEffect(() => {
    const fetchUsedVouchers = async () => {
      if (!user || !user.id) return;
      
      try {
        setLoadingVouchers(true);
        const response = await fetch(`/api/dashboard/today-used-vouchers?userId=${user.id}`);
        const result = await response.json();

        if (result.ok) {
          setUsedVouchers(result.data);
          setIsAdmin(result.isAdmin);
        }
      } catch (error) {
        console.error('오늘 사용된 교환권 조회 오류:', error);
      } finally {
        setLoadingVouchers(false);
      }
    };

    fetchUsedVouchers();
    
    // 30초마다 자동 새로고침
    const interval = setInterval(fetchUsedVouchers, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // 금액 포맷팅
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };

  // 시간 포맷팅
  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm', { locale: ko });
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#6b7280' }}>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8fafc',
        padding: '20px'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '16px'
        }}>
          🔐
        </div>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#1f2937',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          로그인이 필요합니다
        </h2>
        <p style={{
          color: '#6b7280',
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          교환권 시스템을 사용하려면 로그인해주세요
        </p>
        <button
          onClick={() => window.location.href = '/login'}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          로그인 페이지로 이동
        </button>
      </div>
    );
  }

  return (
    <MobileLayout>
      <div style={{
        padding: '20px',
        paddingBottom: '100px', // 하단 네비게이션 공간 확보
        backgroundColor: '#f8fafc',
        minHeight: '100%'
      }}>
        {/* 환영 섹션 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>👋</div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '4px'
          }}>
            안녕하세요, {user.name}님
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: '16px'
          }}>
            {user.site_name} • {user.role === 'admin' ? '관리자' : user.role === 'staff' ? '직원' : '뷰어'}
          </p>
        </div>

        {/* 빠른 액션 버튼들 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => window.location.href = '/mobile/scan'}
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '16px',
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              minHeight: '120px',
              justifyContent: 'center'
            }}
          >
            <span style={{ fontSize: '32px' }}>📱</span>
            <span>QR 스캔</span>
            <span style={{ fontSize: '12px', opacity: 0.9 }}>교환권 사용등록</span>
          </button>

          <button
            onClick={() => window.location.href = '/mobile/search'}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '16px',
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              minHeight: '120px',
              justifyContent: 'center'
            }}
          >
            <span style={{ fontSize: '32px' }}>🔍</span>
            <span>교환권 조회</span>
            <span style={{ fontSize: '12px', opacity: 0.9 }}>상태 확인</span>
          </button>
        </div>

        {/* 오늘 사용된 교환권 목록 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1f2937'
            }}>
              📊 오늘 사용된 교환권
            </h2>
            <div style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {usedVouchers.length}건
            </div>
          </div>

          {loadingVouchers ? (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100px',
              color: '#6b7280'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid #e5e7eb',
                  borderTop: '3px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 12px'
                }} />
                <p style={{ fontSize: '14px' }}>로딩 중...</p>
              </div>
            </div>
          ) : usedVouchers.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
              <p>오늘 사용된 교환권이 없습니다</p>
            </div>
          ) : (
            <div style={{
              maxHeight: '400px',
              overflowY: 'auto',
              margin: '-8px'
            }}>
              {usedVouchers.map((voucher, index) => (
                <div
                  key={voucher.id}
                  style={{
                    padding: '12px',
                    borderBottom: index < usedVouchers.length - 1 ? '1px solid #f3f4f6' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  {/* 첫번째 줄: 시간, 사업장, 금액 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{
                        fontSize: '14px',
                        color: '#6b7280',
                        fontWeight: '500'
                      }}>
                        {formatTime(voucher.used_at)}
                      </span>
                      {isAdmin && (
                        <span style={{
                          fontSize: '12px',
                          backgroundColor: '#f3f4f6',
                          color: '#4b5563',
                          padding: '2px 8px',
                          borderRadius: '8px'
                        }}>
                          {voucher.site_name}
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#10b981'
                    }}>
                      {formatAmount(voucher.amount)}
                    </span>
                  </div>

                  {/* 두번째 줄: 회원 정보 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      color: '#374151'
                    }}>
                      <span style={{ fontWeight: '500' }}>{voucher.name}</span>
                      <span style={{ color: '#6b7280', marginLeft: '8px' }}>
                        ({voucher.association} · {voucher.member_id})
                      </span>
                    </div>
                  </div>

                  {/* 세번째 줄: 일련번호, 사용 등록자 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px',
                    color: '#9ca3af'
                  }}>
                    <span>#{voucher.serial_no}</span>
                    <span>등록: {voucher.used_by}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}