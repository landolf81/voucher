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
  const [message, setMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);
  const router = useRouter();
  const [isProcessingMagicLink, setIsProcessingMagicLink] = useState(false);
  
  // OAuth 연동 상태 (useEffect에서 사용되므로 최상단에 선언)
  const [isLinkingKakao, setIsLinkingKakao] = useState(false);

  // Magic Link 처리 - Safari 호환성 개선
  useEffect(() => {
    const handleMagicLink = async () => {
      try {
        // URL에서 Magic Link 파라미터 확인
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const searchParams = new URLSearchParams(window.location.search);
        
        // Supabase는 hash fragment에 토큰을 포함시킴
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = searchParams.get('type');
        
        console.log('Magic Link 파라미터 확인:', { 
          hasAccessToken: !!accessToken, 
          hasRefreshToken: !!refreshToken, 
          type,
          isSafari: device.isSafari,
          isIOS: device.isIOS
        });
        
        if ((accessToken || refreshToken) && type === 'magiclink' && !isProcessingMagicLink) {
          setIsProcessingMagicLink(true);
          setMessage({ type: 'success', text: 'Magic Link를 처리 중입니다...' });
          
          const supabase = getSupabaseClient();
          
          // Safari/iOS에서 약간의 지연 추가
          if (device.isSafari || device.isIOS) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
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
              setMessage({ type: 'success', text: '로그인이 완료되었습니다.' });
              
              // URL 정리 - Safari에서는 pushState 사용
              if (device.isSafari || device.isIOS) {
                window.history.pushState({}, document.title, '/login');
              } else {
                window.history.replaceState({}, document.title, '/login');
              }
              
              // Safari/iOS에서는 추가 지연 후 리다이렉션 대기
              if (device.isSafari || device.isIOS) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }
        }
      } catch (error) {
        console.error('Magic Link 처리 오류:', error);
        setMessage({ type: 'error', text: 'Magic Link 처리 중 오류가 발생했습니다.' });
      } finally {
        setIsProcessingMagicLink(false);
      }
    };
    
    // Safari/iOS에서는 페이지 로드 후 약간의 지연
    if (device.isSafari || device.isIOS) {
      setTimeout(handleMagicLink, 500);
    } else {
      handleMagicLink();
    }
  }, [device.isSafari, device.isIOS]);

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
  // AuthContext의 getSession과 충돌하지 않도록 onAuthStateChange 이벤트로 확인
  useEffect(() => {
    // isLoading이 완료된 후에만 확인 (AuthContext 초기화 완료 후)
    if (isLoading || user || isLinkingKakao) return;

    const checkKakaoLinkingAfterAuth = async () => {
      const supabase = getSupabaseClient();

      // onAuthStateChange를 사용하여 세션 확인 (getSession 직접 호출 대신)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          // INITIAL_SESSION 이벤트에서만 처리
          if (event !== 'INITIAL_SESSION' || !session?.user) return;

          console.log('카카오 OAuth 세션 확인 (onAuthStateChange):', session.user.id);

          // OAuth 사용자이고 프로필이 없는 경우 연동 필요
          const isOAuthUser = session.user.app_metadata?.provider === 'kakao';

          if (isOAuthUser) {
            console.log('카카오 사용자 연동 확인 중...');

            try {
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
            } catch (error) {
              console.error('카카오 연동 상태 확인 오류:', error);
            }
          }

          // 한 번만 실행 후 구독 해제
          subscription.unsubscribe();
        }
      );

      return () => subscription.unsubscribe();
    };

    checkKakaoLinkingAfterAuth();
  }, [user, isLoading, isLinkingKakao]);

  useEffect(() => {
    // 디버깅용 로그 추가
    console.log('리다이렉션 useEffect 실행:', {
      isLoading,
      isProcessingMagicLink,
      isAuthenticated,
      hasUser: !!user,
      isLinkingKakao,
      userName: user?.name
    });
    
    if (!isLoading && !isProcessingMagicLink && isAuthenticated && user && !isLinkingKakao) {
      // 디바이스에 따른 라우팅 - Safari 특별 처리
      console.log('리다이렉션 확인:', { 
        isMobile: device.isMobile, 
        isSafari: device.isSafari, 
        isIOS: device.isIOS,
        userAgent: device.userAgent 
      });
      
      const redirectUrl = device.isMobile ? '/mobile' : '/chat';
      console.log('리다이렉션 URL:', redirectUrl);
      
      // Safari에서는 짧은 지연 후 리다이렉션
      if (device.isSafari || device.isIOS) {
        setTimeout(() => {
          router.replace(redirectUrl);
        }, 500);
      } else {
        router.replace(redirectUrl);
      }
    }
  }, [isAuthenticated, isLoading, isProcessingMagicLink, user, router, device.isMobile, device.isSafari, device.isIOS, isLinkingKakao]);

  const [authStep, setAuthStep] = useState<'id' | 'code'>('id');
  const [authMethod, setAuthMethod] = useState<'sms' | 'email'>('sms');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [actualPhone, setActualPhone] = useState(''); // 실제 DB에서 조회된 전화번호
  const [actualEmail, setActualEmail] = useState(''); // 실제 DB에서 조회된 이메일
  const [kakaoAuthUserId, setKakaoAuthUserId] = useState<string | null>(null);
  const [linkingPhone, setLinkingPhone] = useState('');
  const [userHasEmail, setUserHasEmail] = useState<boolean | null>(null); // 사용자 이메일 보유 상태
  const [needsEmailSetup, setNeedsEmailSetup] = useState(false); // 이메일 설정 필요 여부
  const [userStatus, setUserStatus] = useState<any>(null); // 전체 사용자 상태
  const [statusChecked, setStatusChecked] = useState(false); // 상태 확인 완료 여부

  const [formData, setFormData] = useState({
    employeeId: '',
    email: '',
    phone: '',
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

  // 사용자 상태 확인 함수
  const checkUserStatus = async (employeeId: string) => {
    try {
      const response = await fetch('/api/auth/check-user-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: employeeId })
      });

      const result = await response.json();
      
      if (result.success) {
        setUserStatus(result);
        setUserHasEmail(result.has_email);
        setNeedsEmailSetup(result.needs_email_setup);
        setStatusChecked(true);
        
        // 이메일이 있는 경우 자동으로 이메일 방식으로 설정
        if (result.has_email) {
          setAuthMethod('email');
        }
        
        return result;
      } else {
        setMessage({ type: 'error', text: result.message });
        return null;
      }
    } catch (error) {
      console.error('사용자 상태 확인 오류:', error);
      setMessage({ type: 'error', text: '사용자 상태 확인 중 오류가 발생했습니다.' });
      return null;
    }
  };

  const handleEmployeeIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId) {
      setMessage({ type: 'error', text: '사번을 입력해주세요.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // 먼저 사용자 상태 확인
      if (!statusChecked) {
        const userStatusResult = await checkUserStatus(formData.employeeId);
        if (!userStatusResult) {
          setLoading(false);
          return;
        }
        
        setLoading(false);
        setMessage({ 
          type: 'info', 
          text: `${userStatusResult.user.name}님, 인증 방법을 선택하고 다음을 클릭하세요.` 
        });
        return;
      }

      // 상태 확인 완료 후 실제 인증 진행
      const response = await fetch('/api/auth/link-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: formData.employeeId,
          auto_lookup: true,
          preferred_method: authMethod
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // 사용자 이메일 상태 저장
        setUserHasEmail(result.has_email);
        setNeedsEmailSetup(result.needs_email_setup);
        
        // 인증 방법에 따라 다음 단계 결정 (이메일, SMS 모두 코드 입력 단계로)
        if (result.auth_method === 'email') {
          setAuthStep('code');
          setAuthMethod('email');
          setActualEmail(result.actual_email);
          setMessage({
            type: 'success',
            text: result.message
          });
          setFormData(prev => ({
            ...prev,
            name: result.user.name,
            role: result.user.role
          }));
        } else if (result.auth_method === 'sms') {
          setAuthStep('code');
          setAuthMethod('sms');
          setActualPhone(result.actual_phone);
          setMessage({
            type: 'success',
            text: result.message
          });
          setFormData(prev => ({
            ...prev,
            name: result.user.name,
            role: result.user.role
          }));
        }
      } else {
        // 이메일이 있는 사용자가 SMS를 시도한 경우
        if (result.has_email && result.redirect_to_email) {
          setMessage({ 
            type: 'info', 
            text: result.message + ' 이메일 인증을 선택해주세요.' 
          });
          setAuthMethod('email'); // 자동으로 이메일 방식으로 변경
          setUserHasEmail(true);
        } else {
          setMessage({ type: 'error', text: result.message });
        }
      }
    } catch (error: any) {
      console.error('사용자 조회 오류:', error);
      setMessage({ type: 'error', text: '사용자 조회 중 오류가 발생했습니다.' });
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
          email: authMethod === 'email' ? actualEmail : undefined,
          phone: authMethod === 'sms' ? actualPhone : undefined,
          token: verificationCode
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: 'success', text: result.message || '로그인에 성공했습니다.' });
        
        // Supabase 클라이언트에 세션 설정
        if (result.session) {
          const supabase = getSupabaseClient();
          await supabase.auth.setSession({
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token
          });
          console.log('세션이 설정되었습니다:', result.session.access_token.substring(0, 20) + '...');
        }
        
        setTimeout(() => {
          // 이메일 설정이 필요한 경우 이메일 등록 페이지로 리다이렉트
          if (needsEmailSetup) {
            console.log('이메일 설정 페이지로 리다이렉션');
            router.push('/profile/email-setup');
          } else {
            const redirectUrl = device.isMobile ? '/mobile' : '/chat';
            console.log('SMS 인증 후 리다이렉션:', redirectUrl);
            router.push(redirectUrl);
          }
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
      
      // OAuth 로그인 시작 - Supabase 문서 권장 스코프 사용
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/login`,
          // Supabase 문서에서 권장하는 기본 스코프들
          // 카카오 개발자 콘솔에서 이 동의 항목들이 활성화되어야 함
          scopes: 'openid account_email profile_nickname profile_image'
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

        {/* OTP 인증 로그인 폼 */}
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
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
                placeholder="사번을 입력하세요"
              />
            </div>

            {/* 인증 방법 선택 - 사용자 이메일 상태에 따라 조건부 렌더링 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                인증 방법 선택
              </label>
              
              {statusChecked && userStatus ? (
                // 사용자 상태 확인 완료 후 적절한 옵션 표시
                userStatus.has_email ? (
                  // 이메일이 있는 사용자는 이메일만 사용 가능
                  <div style={{
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #0ea5e9',
                    borderRadius: '8px',
                    padding: '12px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px'
                    }}>
                      <span style={{ fontSize: '18px' }}>📧</span>
                      <span style={{ 
                        fontSize: '14px', 
                        fontWeight: '500',
                        color: '#0c4a6e'
                      }}>
                        이메일 인증
                      </span>
                    </div>
                    <p style={{
                      fontSize: '12px',
                      color: '#075985',
                      margin: '0 0 8px 0',
                      lineHeight: '1.4'
                    }}>
                      등록된 이메일: <strong>{userStatus.email}</strong><br />
                      SMS 비용 절약을 위해 이메일 인증만 사용됩니다.
                    </p>
                  </div>
                ) : userStatus.has_phone ? (
                  // 이메일이 없는 사용자는 SMS만 사용 가능 + 이메일 등록 권장
                  <div>
                    <div style={{
                      backgroundColor: '#fef3c7',
                      border: '1px solid #f59e0b',
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '12px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px'
                      }}>
                        <span style={{ fontSize: '18px' }}>📱</span>
                        <span style={{ 
                          fontSize: '14px', 
                          fontWeight: '500',
                          color: '#92400e'
                        }}>
                          SMS 인증 (일시적)
                        </span>
                      </div>
                      <p style={{
                        fontSize: '12px',
                        color: '#92400e',
                        margin: 0,
                        lineHeight: '1.4'
                      }}>
                        등록된 전화번호: <strong>{userStatus.phone}</strong><br />
                        SMS 비용 절약을 위해 이메일 등록을 권장합니다.
                      </p>
                    </div>
                  </div>
                ) : (
                  // 이메일도 전화번호도 없는 경우
                  <div style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    padding: '12px'
                  }}>
                    <p style={{
                      fontSize: '12px',
                      color: '#dc2626',
                      margin: 0,
                      lineHeight: '1.4'
                    }}>
                      등록된 연락처 정보가 없습니다.<br />
                      관리자에게 문의하세요.
                    </p>
                  </div>
                )
              ) : (
                // 초기 상태 - 사용자 확인 전
                <div style={{
                  backgroundColor: '#f9fafb',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  padding: '12px',
                  textAlign: 'center'
                }}>
                  <p style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    margin: 0
                  }}>
                    사번을 입력하고 "사용자 확인"을 클릭하세요.
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || (statusChecked && userStatus && !userStatus.available_auth_methods.includes(authMethod))}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: loading || (statusChecked && userStatus && !userStatus.available_auth_methods.includes(authMethod)) ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: loading || (statusChecked && userStatus && !userStatus.available_auth_methods.includes(authMethod)) ? 'not-allowed' : 'pointer',
                marginBottom: '16px'
              }}
            >
              {loading ? '처리 중...' : statusChecked ? '인증하기' : '사용자 확인'}
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
                {authMethod === 'sms' ? 'SMS' : '이메일'}로 전송된 6자리 코드를 입력하세요
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
                onClick={() => {
                  setAuthStep('id');
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
                이전으로
              </button>
              
              <button
                type="button"
                onClick={() => {
                  // 다시 인증 코드 전송
                  handleEmployeeIdSubmit(new Event('submit') as any);
                }}
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


      </div>
    </div>
  );
}