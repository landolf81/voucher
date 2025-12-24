'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useDevice } from '@/lib/hooks/useDevice';

export default function EmailSetupPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const device = useDevice();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);
  const [email, setEmail] = useState('');
  const [isEmailSent, setIsEmailSent] = useState(false);

  // 인증되지 않은 사용자는 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
      return;
    }
    
    // 이미 이메일이 있는 사용자는 대시보드로 리다이렉트
    if (!isLoading && isAuthenticated && user?.email) {
      const redirectUrl = device.isMobile ? '/mobile' : '/admin/dashboard';
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, isLoading, user, router, device.isMobile]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setMessage({ type: 'error', text: '올바른 이메일 주소를 입력해주세요.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/register-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          user_id: user?.user_id
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setIsEmailSent(true);
        setMessage({ 
          type: 'success', 
          text: result.message + ' 이메일의 인증 링크를 클릭해주세요.' 
        });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error: any) {
      console.error('이메일 등록 오류:', error);
      setMessage({ type: 'error', text: '이메일 등록 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 로딩 중이면 로딩 화면 표시
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h2>로딩 중...</h2>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '20px auto'
          }}></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '32px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '500px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: '#dbeafe',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '28px'
          }}>
            📧
          </div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#1a202c',
            marginBottom: '8px'
          }}>
            이메일 등록
          </h1>
          <p style={{ 
            color: '#6b7280',
            lineHeight: '1.5' 
          }}>
            안녕하세요, <strong>{user?.name}</strong>님!<br />
            SMS 비용 절약을 위해 이메일 인증을 설정해주세요.
          </p>
        </div>

        {message && (
          <div style={{
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '24px',
            backgroundColor: message.type === 'success' ? '#dcfce7' : message.type === 'error' ? '#fef2f2' : '#dbeafe',
            color: message.type === 'success' ? '#166534' : message.type === 'error' ? '#dc2626' : '#1e40af',
            border: `1px solid ${message.type === 'success' ? '#bbf7d0' : message.type === 'error' ? '#fecaca' : '#bfdbfe'}`,
            fontSize: '14px',
            lineHeight: '1.5'
          }}>
            {message.text}
          </div>
        )}

        {!isEmailSent ? (
          <form onSubmit={handleEmailSubmit}>
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                이메일 주소
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
                placeholder="your-email@company.com"
              />
              <p style={{ 
                fontSize: '12px', 
                color: '#6b7280', 
                marginTop: '4px' 
              }}>
                입력하신 이메일로 인증 링크를 보내드립니다.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: loading || !email ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: loading || !email ? 'not-allowed' : 'pointer',
                marginBottom: '16px'
              }}
            >
              {loading ? '전송 중...' : '이메일 인증 링크 받기'}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              backgroundColor: '#f0f9ff',
              border: '1px solid #0ea5e9',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '12px'
              }}>
                ✉️
              </div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#0c4a6e',
                marginBottom: '8px'
              }}>
                이메일을 확인해주세요
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#075985',
                lineHeight: '1.5'
              }}>
                <strong>{email}</strong>로<br />
                인증 링크를 보내드렸습니다.
              </p>
            </div>
            
            <button
              onClick={() => {
                setIsEmailSent(false);
                setMessage(null);
              }}
              style={{
                backgroundColor: 'transparent',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              다른 이메일로 변경
            </button>
          </div>
        )}

        <div style={{
          textAlign: 'center',
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <p style={{
            fontSize: '12px',
            color: '#6b7280',
            lineHeight: '1.5'
          }}>
            💡 <strong>안내:</strong> 이메일 등록 후 다음 로그인부터는<br />
            SMS 대신 이메일 인증만 사용됩니다.
          </p>
          
          <button
            onClick={() => {
              const redirectUrl = device.isMobile ? '/mobile' : '/admin/dashboard';
              router.push(redirectUrl);
            }}
            style={{
              marginTop: '16px',
              backgroundColor: 'transparent',
              color: '#3b82f6',
              border: 'none',
              fontSize: '14px',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            나중에 등록하기
          </button>
        </div>
      </div>
    </div>
  );
}