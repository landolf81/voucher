'use client';

import React, { useState, useEffect } from 'react';

interface OAuthAccount {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  oauth_provider?: string;
  oauth_provider_id?: string;
  oauth_linked_at?: string;
  site_name?: string;
  is_active: boolean;
}

export function OAuthAccountManager() {
  const [accounts, setAccounts] = useState<OAuthAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOAuthAccounts();
  }, []);

  const loadOAuthAccounts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/oauth-accounts');
      const data = await response.json();

      if (data.success) {
        setAccounts(data.accounts || []);
      } else {
        setError(data.message || 'OAuth 계정을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('OAuth 계정 로드 오류:', error);
      setError('OAuth 계정을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkAccount = async (userId: string, userName: string) => {
    if (!confirm(`${userName}님의 OAuth 연동을 해제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/oauth-accounts/unlink', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (data.success) {
        alert('OAuth 연동이 해제되었습니다.');
        loadOAuthAccounts(); // 목록 새로고침
      } else {
        alert(data.message || 'OAuth 연동 해제에 실패했습니다.');
      }
    } catch (error) {
      console.error('OAuth 연동 해제 오류:', error);
      alert('OAuth 연동 해제 중 오류가 발생했습니다.');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getProviderDisplay = (provider?: string) => {
    switch (provider) {
      case 'kakao':
        return '💬 카카오';
      default:
        return provider || '-';
    }
  };

  if (loading) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '48px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        OAuth 계정 정보를 불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '48px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <div style={{ color: '#dc2626', marginBottom: '16px' }}>{error}</div>
        <button
          onClick={loadOAuthAccounts}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            cursor: 'pointer'
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  const oauthAccounts = accounts.filter(account => account.oauth_provider);
  const regularAccounts = accounts.filter(account => !account.oauth_provider);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* OAuth 연동 계정 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px 24px',
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1a202c',
            margin: 0
          }}>
            OAuth 연동 계정
          </h3>
          <span style={{
            fontSize: '14px',
            color: '#6b7280'
          }}>
            총 {oauthAccounts.length}건
          </span>
        </div>

        {oauthAccounts.length === 0 ? (
          <div style={{
            padding: '48px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            OAuth 연동된 계정이 없습니다.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    이름
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    연락처
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    OAuth 제공자
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    연동일
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    사업장
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    관리
                  </th>
                </tr>
              </thead>
              <tbody>
                {oauthAccounts.map((account) => (
                  <tr key={account.id}>
                    <td style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #e5e7eb',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {account.name}
                        <span style={{
                          fontSize: '12px',
                          backgroundColor: account.is_active ? '#dcfce7' : '#fee2e2',
                          color: account.is_active ? '#16a34a' : '#dc2626',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {account.is_active ? '활성' : '비활성'}
                        </span>
                      </div>
                    </td>
                    <td style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #e5e7eb',
                      fontSize: '14px',
                      color: '#6b7280'
                    }}>
                      <div>
                        {account.phone && <div>📱 {account.phone}</div>}
                        {account.email && <div>✉️ {account.email}</div>}
                      </div>
                    </td>
                    <td style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #e5e7eb',
                      textAlign: 'center'
                    }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: '#fef3c7',
                        color: '#d97706'
                      }}>
                        {getProviderDisplay(account.oauth_provider)}
                      </span>
                    </td>
                    <td style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #e5e7eb',
                      fontSize: '13px',
                      color: '#6b7280',
                      textAlign: 'center'
                    }}>
                      {formatDate(account.oauth_linked_at)}
                    </td>
                    <td style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #e5e7eb',
                      fontSize: '14px',
                      color: '#6b7280'
                    }}>
                      {account.site_name || '-'}
                    </td>
                    <td style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #e5e7eb',
                      textAlign: 'center'
                    }}>
                      <button
                        onClick={() => handleUnlinkAccount(account.id, account.name)}
                        style={{
                          backgroundColor: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}
                      >
                        연동해제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 통계 정보 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6b7280' }}>
            전체 회원 수
          </h4>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>
            {accounts.length}
          </p>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6b7280' }}>
            OAuth 연동 회원
          </h4>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#059669' }}>
            {oauthAccounts.length}
          </p>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6b7280' }}>
            일반 회원
          </h4>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#3b82f6' }}>
            {regularAccounts.length}
          </p>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6b7280' }}>
            카카오 연동률
          </h4>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#f59e0b' }}>
            {accounts.length > 0 ? Math.round((oauthAccounts.length / accounts.length) * 100) : 0}%
          </p>
        </div>
      </div>
    </div>
  );
}