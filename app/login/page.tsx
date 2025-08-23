'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useDevice } from '@/lib/hooks/useDevice';

export default function LoginPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const device = useDevice();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const router = useRouter();

  // 이미 로그인된 사용자는 대시보드로 리다이렉트
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      // 디바이스에 따른 라우팅
      const redirectUrl = device.isMobile ? '/mobile' : '/admin/dashboard';
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, isLoading, user, router, device.isMobile]);

  const [authStep, setAuthStep] = useState<'id' | 'verification' | 'code'>('id');
  const [verificationMethod, setVerificationMethod] = useState<'sms' | 'email'>('sms');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState('');

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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    console.log('회원가입 시도 - formData:', formData);

    // 비밀번호 확인
    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: '비밀번호가 일치하지 않습니다.' });
      setLoading(false);
      return;
    }

    // 필수 필드 확인
    const missingFields = [];
    if (!formData.email) missingFields.push('이메일');
    if (!formData.password) missingFields.push('비밀번호');
    if (!formData.confirmPassword) missingFields.push('비밀번호 확인');
    if (!formData.name) missingFields.push('이름');
    if (!formData.site_id) missingFields.push('소속 사업장');
    if (!formData.phone) missingFields.push('휴대폰 번호');
    
    if (missingFields.length > 0) {
      console.log('누락된 필드:', missingFields);
      setMessage({ type: 'error', text: `다음 필드를 입력해주세요: ${missingFields.join(', ')}` });
      setLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseClient();

      // 1. Auth 사용자 생성
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        phone: formData.phone.startsWith('+82') ? formData.phone : `+82${formData.phone.replace(/^0/, '')}`,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`
        }
      });

      if (authError) {
        throw authError;
      }

      if (authData.user) {
        // 2. 프로필 생성
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert([{
            id: authData.user.id,
            name: formData.name,
            role: formData.role,
            site_id: formData.site_id,
            is_active: true
          }]);

        if (profileError) {
          throw profileError;
        }

        setMessage({ 
          type: 'success', 
          text: '회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.' 
        });
        
        // 로그인 폼으로 전환
        setTimeout(() => {
          setIsSignUp(false);
          setFormData({
            employeeId: '',
            email: formData.email,
            phone: '',
            password: '',
            confirmPassword: '',
            name: '',
            role: 'staff',
            site_id: ''
          });
        }, 2000);
      }

    } catch (error: any) {
      console.error('회원가입 오류:', error);
      setMessage({ 
        type: 'error', 
        text: error.message.includes('already registered') 
          ? '이미 등록된 이메일입니다.'
          : '회원가입에 실패했습니다.'
      });
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
            {isSignUp ? '회원가입' : '로그인'}
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

        {!isSignUp && authStep === 'id' && (
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

        {!isSignUp && authStep === 'verification' && (
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

        {!isSignUp && authStep === 'code' && (
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

        {isSignUp && (
          <form onSubmit={handleSignUp}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                이메일
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

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                비밀번호
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
                placeholder="비밀번호를 입력하세요"
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
                비밀번호 확인
              </label>
              <input
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
                placeholder="비밀번호를 다시 입력하세요"
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
                이름
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
                placeholder="이름을 입력하세요"
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

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                권한
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  color: '#374151'
                }}
              >
                <option value="staff">직원</option>
                <option value="viewer">조회만</option>
                <option value="part_time">아르바이트</option>
                <option value="admin">관리자</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                소속 사업장
              </label>
              <select
                required
                value={formData.site_id}
                onChange={(e) => setFormData({...formData, site_id: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  color: '#374151'
                }}
              >
                <option value="">사업장을 선택하세요</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.site_name}
                  </option>
                ))}
              </select>
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
              {loading ? '처리 중...' : '회원가입'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage(null);
              setAuthStep('id');
              setVerificationCode('');
              setVerificationId('');
              setFormData({
                employeeId: '',
                email: '',
                phone: '',
                password: '',
                confirmPassword: '',
                name: '',
                role: 'staff',
                site_id: ''
              });
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#3b82f6',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
          </button>
        </div>
      </div>
    </div>
  );
}