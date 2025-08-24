'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useDevice } from '@/lib/hooks/useDevice';

export default function LoginPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const device = useDevice();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const router = useRouter();
  const [isProcessingMagicLink, setIsProcessingMagicLink] = useState(false);

  // Magic Link 처리
  useEffect(() => {
    const handleMagicLink = async () => {
      // URL에서 Magic Link 파라미터 확인
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const searchParams = new URLSearchParams(window.location.search);
      
      // Supabase는 hash fragment에 토큰을 포함시킴
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = searchParams.get('type');
      
      if ((accessToken || refreshToken) && type === 'magiclink' && !isProcessingMagicLink) {
        setIsProcessingMagicLink(true);
        setMessage({ type: 'success', text: 'Magic Link를 처리 중입니다...' });
        
        try {
          const supabase = getSupabaseClient();
          
          // 세션 설정
          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (error) {
              console.error('세션 설정 오류:', error);
              setMessage({ type: 'error', text: '로그인 처리 중 오류가 발생했습니다.' });
            } else {
              console.log('Magic Link 로그인 성공');
              // URL 정리
              window.history.replaceState({}, document.title, '/login');
              // 인증 상태가 업데이트되면 자동으로 리다이렉트됨
            }
          }
        } catch (error) {
          console.error('Magic Link 처리 오류:', error);
          setMessage({ type: 'error', text: 'Magic Link 처리 중 오류가 발생했습니다.' });
        } finally {
          setIsProcessingMagicLink(false);
        }
      }
    };
    
    handleMagicLink();
  }, [isProcessingMagicLink]);

  // 이미 로그인된 사용자는 대시보드로 리다이렉트
  // OAuth 연동 필요 확인
  useEffect(() => {
    const checkOAuthLinking = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('oauth_linking_required') === 'true') {
        console.log('OAuth 연동이 필요한 상태입니다.');
        setMessage({ type: 'info', text: '카카오 계정을 기존 회원과 연동해야 합니다.' });
        // URL 파라미터 제거
        window.history.replaceState({}, document.title, '/login');
      }
    };
    
    checkOAuthLinking();
  }, []);

  // 카카오 OAuth 리다이렉트 후 연동 상태 확인
  useEffect(() => {
    const checkKakaoLinkingAfterAuth = async () => {
      const supabase = getSupabaseClient();
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session && session.user && !user && !isLinkingKakao) {
          console.log('카카오 OAuth 세션 확인:', session.user.id);
          
          // OAuth 사용자이고 프로필이 없는 경우 연동 필요
          const isOAuthUser = session.user.app_metadata?.provider === 'kakao';
          
          if (isOAuthUser) {
            console.log('카카오 사용자 연동 확인 중...');
            
            const response = await fetch('/api/auth/check-oauth-linking', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                authUserId: session.user.id
              }),
            });
            
            const linkingData = await response.json();
            
            if (linkingData.success && linkingData.linking_required) {
              console.log('카카오 계정 연동 필요');
              setIsLinkingKakao(true);
              setKakaoAuthUserId(session.user.id);
              setMessage({ 
                type: 'info', 
                text: '카카오 계정을 기존 회원과 연동해야 합니다. 휴대폰 번호를 입력하세요.' 
              });
            }
          }
        }
      } catch (error) {
        console.error('카카오 연동 상태 확인 오류:', error);
      }
    };

    // 페이지 로드 시와 세션 변경 시 확인
    if (!user && !isLoading) {
      checkKakaoLinkingAfterAuth();
    }
  }, [user, isLoading, isLinkingKakao]);

  useEffect(() => {
    if (!isLoading && !isProcessingMagicLink && isAuthenticated && user && !isLinkingKakao) {
      // 디바이스에 따른 라우팅
      const redirectUrl = device.isMobile ? '/mobile' : '/admin/dashboard';
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, isLoading, isProcessingMagicLink, user, router, device.isMobile, isLinkingKakao]);

  const [authStep, setAuthStep] = useState<'id' | 'verification' | 'code'>('id');
  const [verificationMethod, setVerificationMethod] = useState<'sms' | 'email'>('sms');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
  
  // OAuth 연동 상태
  const [isLinkingKakao, setIsLinkingKakao] = useState(false);
  const [kakaoAuthUserId, setKakaoAuthUserId] = useState<string | null>(null);
  const [linkingPhone, setLinkingPhone] = useState('');

  const [formData, setFormData] = useState({
    employeeId: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    name: '',
    role: 'staff' as 'admin' | 'staff' | 'viewer' | 'part_time',
    site_id: ''
  });

  const [sites, setSites] = useState<any[]>([]);

  // 사이트 목록 조회
  const fetchSites = async () => {
    try {
      const response = await fetch('/api/sites');
      const result = await response.json();
      if (result.success) {
        setSites(result.data || []);
      }
    } catch (error) {
      console.error('사이트 목록 조회 오류:', error);
    }
  };

  // 컴포넌트 마운트 시 사이트 목록 조회
  useEffect(() => {
    fetchSites();
  }, []);

  const handleEmployeeIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId) {
      setMessage({ type: 'error', text: '사번을 입력해주세요.' });
      return;
    }
    setAuthStep('verification');
  };

  const handleVerificationMethodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // 새로운 link-user API 사용
      const response = await fetch('/api/auth/link-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: formData.employeeId,
          email: verificationMethod === 'email' ? formData.email : undefined,
          phone: verificationMethod === 'sms' ? formData.phone : undefined
        })
      });

      const result = await response.json();
      
      if (result.success) {
        if (verificationMethod === 'email') {
          // 이메일은 Magic Link 방식이므로 코드 입력 단계 없이 완료
          setMessage({ 
            type: 'success', 
            text: result.message + ' 이메일의 링크를 클릭하여 로그인을 완료하세요.' 
          });
        } else {
          // SMS는 기존대로 코드 입력 단계로
          setAuthStep('code');
          setMessage({ 
            type: 'success', 
            text: result.message 
          });
        }
      } else {
        setMessage({ type: 'error', text: result.message || '인증 코드 전송에 실패했습니다.' });
      }
    } catch (error: any) {
      console.error('인증 코드 전송 오류:', error);
      setMessage({ type: 'error', text: '인증 코드 전송 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // 새로운 verify-otp API 사용
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: verificationMethod === 'email' ? formData.email : undefined,
          phone: verificationMethod === 'sms' ? formData.phone : undefined,
          token: verificationCode
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: 'success', text: result.message || '로그인에 성공했습니다.' });
        
        // 세션 정보 저장 (필요시)
        if (result.session) {
          localStorage.setItem('supabase.auth.token', JSON.stringify(result.session));
        }
        
        setTimeout(() => {
          router.push('/admin/dashboard');
        }, 1000);
      } else {
        setMessage({ type: 'error', text: result.message || '인증 코드가 올바르지 않습니다.' });
      }
    } catch (error: any) {
      console.error('인증 코드 검증 오류:', error);
      setMessage({ type: 'error', text: '인증 코드 검증 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 카카오 소셜 로그인 처리
  const handleKakaoLogin = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const supabase = getSupabaseClient();
      
      // OAuth 로그인 시작 - 개인정보 스코프 없이 기본만
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/login`,
          // 개인정보 스코프 제외 - 기본 로그인만
          scopes: undefined
        }
      });

      if (error) {
        console.error('카카오 로그인 오류:', error);
        setMessage({ type: 'error', text: '카카오 로그인에 실패했습니다.' });
      }
      // 성공 시 카카오 리다이렉트는 자동으로 처리됨
      // 실제 연동 확인은 페이지 리로드 후 useEffect에서 처리
    } catch (error: any) {
      console.error('카카오 로그인 처리 오류:', error);
      setMessage({ type: 'error', text: '카카오 로그인 처리 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 카카오 연동 처리 함수
  const handleKakaoLinking = async (phone: string, verificationCode: string) => {
    if (!kakaoAuthUserId) {
      setMessage({ type: 'error', text: '카카오 인증 정보가 없습니다.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/link-kakao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phone,
          verificationCode: verificationCode,
          authUserId: kakaoAuthUserId
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        
        // 연동 성공 후 로그인 완료
        setTimeout(() => {
          setIsLinkingKakao(false);
          setKakaoAuthUserId(null);
          setLinkingPhone('');
          
          // 페이지 새로고침으로 로그인 상태 갱신
          window.location.reload();
        }, 1500);
      } else {
        if (data.error === 'no_existing_user') {
          setMessage({ 
            type: 'error', 
            text: '등록된 회원이 아닙니다. 관리자에게 문의하세요.' 
          });
          
          // 3초 후 카카오 로그아웃
          setTimeout(async () => {
            const supabase = getSupabaseClient();
            await supabase.auth.signOut();
            setIsLinkingKakao(false);
            setKakaoAuthUserId(null);
            setLinkingPhone('');
          }, 3000);
        } else {
          setMessage({ type: 'error', text: data.message });
        }
      }
    } catch (error) {
      console.error('카카오 연동 오류:', error);
      setMessage({ type: 'error', text: '연동 처리 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };


  // 인증 상태 로딩 중이면 로딩 화면 표시
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
          <h2>인증 확인 중...</h2>
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
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#1a202c',
            marginBottom: '8px'
          }}>
            교환권 관리 시스템
          </h1>
          <p style={{ color: '#6b7280' }}>
            로그인
          </p>
        </div>

        {message && (
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            backgroundColor: message.type === 'success' ? '#dcfce7' : '#fef2f2',
            color: message.type === 'success' ? '#166534' : '#dc2626',
            border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`
          }}>
            {message.text}
          </div>
        )}

        {authStep === 'id' && (
          <form onSubmit={handleEmployeeIdSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                사번
              </label>
              <input
                type="text"
                required
                value={formData.employeeId}
                onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
                placeholder="사번을 입력하세요"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: '16px'
              }}
            >
              {loading ? '처리 중...' : '다음'}
            </button>
          </form>
        )}

        {authStep === 'verification' && (
          <form onSubmit={handleVerificationMethodSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '12px'
              }}>
                인증 방법을 선택하세요
              </label>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px',
                  border: `2px solid ${verificationMethod === 'sms' ? '#3b82f6' : '#d1d5db'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: verificationMethod === 'sms' ? '#eff6ff' : 'white'
                }}>
                  <input
                    type="radio"
                    name="verificationMethod"
                    value="sms"
                    checked={verificationMethod === 'sms'}
                    onChange={(e) => setVerificationMethod(e.target.value as 'sms' | 'email')}
                    style={{ marginRight: '8px' }}
                  />
                  SMS 인증
                </label>

                <label style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px',
                  border: `2px solid ${verificationMethod === 'email' ? '#3b82f6' : '#d1d5db'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: verificationMethod === 'email' ? '#eff6ff' : 'white'
                }}>
                  <input
                    type="radio"
                    name="verificationMethod"
                    value="email"
                    checked={verificationMethod === 'email'}
                    onChange={(e) => setVerificationMethod(e.target.value as 'sms' | 'email')}
                    style={{ marginRight: '8px' }}
                  />
                  이메일 인증
                </label>
              </div>
            </div>

            {verificationMethod === 'sms' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  휴대폰 번호
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                  placeholder="01012345678"
                />
              </div>
            )}

            {verificationMethod === 'email' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  이메일 주소
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                  placeholder="example@email.com"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: '16px'
              }}
            >
              {loading ? '전송 중...' : '인증 코드 전송'}
            </button>

            <button
              type="button"
              onClick={() => setAuthStep('id')}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'transparent',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              이전으로
            </button>
          </form>
        )}

        {authStep === 'code' && (
          <form onSubmit={handleVerificationCodeSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                인증 코드
              </label>
              <input
                type="text"
                required
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  textAlign: 'center',
                  letterSpacing: '4px'
                }}
                placeholder="6자리 인증 코드"
                maxLength={6}
              />
              <p style={{ 
                fontSize: '12px', 
                color: '#6b7280', 
                marginTop: '4px',
                textAlign: 'center'
              }}>
                {verificationMethod === 'sms' ? 'SMS' : '이메일'}로 전송된 6자리 코드를 입력하세요
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || verificationCode.length !== 6}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: loading || verificationCode.length !== 6 ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: loading || verificationCode.length !== 6 ? 'not-allowed' : 'pointer',
                marginBottom: '16px'
              }}
            >
              {loading ? '인증 중...' : '로그인'}
            </button>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setAuthStep('verification')}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: 'transparent',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                이전으로
              </button>
              
              <button
                type="button"
                onClick={handleVerificationMethodSubmit}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: 'transparent',
                  color: '#3b82f6',
                  border: '1px solid #3b82f6',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? '전송 중...' : '재전송'}
              </button>
            </div>
          </form>
        )}



        {/* 카카오 기존 회원 연동 */}
        {isLinkingKakao && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              backgroundColor: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#92400e',
                margin: '0 0 8px 0'
              }}>
                🔗 카카오 계정 연동
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#92400e',
                margin: 0,
                lineHeight: '1.4'
              }}>
                카카오 로그인은 기존 회원만 사용할 수 있습니다.<br />
                휴대폰 인증을 통해 기존 계정과 연동하세요.
              </p>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (linkingPhone && verificationCode) {
                handleKakaoLinking(linkingPhone, verificationCode);
              }
            }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  휴대폰 번호
                </label>
                <input
                  type="tel"
                  required
                  value={linkingPhone}
                  onChange={(e) => setLinkingPhone(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                  placeholder="010-1234-5678"
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  인증 코드 (테스트용: 1234)
                </label>
                <input
                  type="text"
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                  placeholder="인증 코드를 입력하세요"
                />
                <p style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  margin: '4px 0 0 0'
                }}>
                  현재 테스트 환경에서는 '1234'를 입력하세요.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={async () => {
                    const supabase = getSupabaseClient();
                    await supabase.auth.signOut();
                    setIsLinkingKakao(false);
                    setKakaoAuthUserId(null);
                    setLinkingPhone('');
                    setVerificationCode('');
                    setMessage(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: 'transparent',
                    color: '#6b7280',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  취소
                </button>
                
                <button
                  type="submit"
                  disabled={loading || !linkingPhone || !verificationCode}
                  style={{
                    flex: 2,
                    padding: '12px',
                    backgroundColor: loading || !linkingPhone || !verificationCode ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '500',
                    cursor: loading || !linkingPhone || !verificationCode ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? '연동 중...' : '계정 연동'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 카카오 소셜 로그인 */}
        {authStep === 'id' && !isLinkingKakao && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              margin: '20px 0',
              fontSize: '14px',
              color: '#6b7280'
            }}>
              <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e5e7eb' }} />
              <span style={{ margin: '0 16px' }}>또는</span>
              <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e5e7eb' }} />
            </div>
            
            <button
              type="button"
              onClick={handleKakaoLogin}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: '#FEE500',
                color: '#3B1F1C',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}
            >
              <span style={{ fontSize: '18px' }}>💬</span>
              {loading ? '카카오 로그인 중...' : '카카오로 시작하기'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}