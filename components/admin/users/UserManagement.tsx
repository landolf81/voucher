'use client';

import React, { useState, useEffect } from 'react';
import { formatPhoneForDisplay, formatPhoneInput, cleanPhoneInput, getPhoneValidationMessage } from '@/lib/phone-utils';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  phone_masked: string;
  role: string;
  site_id: string;
  user_id: string;
  is_active: boolean;
  sites?: {
    id: string;
    site_name: string;
  };
  last_sign_in_at?: string;
  email_confirmed_at?: string;
}

interface Site {
  id: string;
  site_name: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    phone: '',
    role: 'staff' as 'admin' | 'staff' | 'viewer' | 'part_time',
    site_id: '',
    user_id: '',
    is_active: true
  });

  // 사용자 목록 조회
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user-profiles');
      const result = await response.json();
      if (result.success) {
        setUsers(result.data?.users || []);
        setSites(result.data?.sites || []);
      }
    } catch (error) {
      console.error('사용자 목록 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 새 사용자 등록
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // 필수 필드 확인
    if (!formData.email || !formData.name || !formData.phone || !formData.site_id || !formData.user_id) {
      setMessage({ type: 'error', text: '모든 필수 필드를 입력해주세요.' });
      setLoading(false);
      return;
    }

    console.log('전송할 formData:', formData);

    try {
      const url = editingUser ? `/api/user-profiles/${editingUser.id}` : '/api/user-profiles';
      const method = editingUser ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      console.log('API 응답 상태:', response.status);
      const result = await response.json();
      console.log('API 응답 데이터:', result);
      
      if (result.success) {
        setMessage({
          type: 'success', 
          text: editingUser ? '사용자 정보가 수정되었습니다.' : '새 사용자가 등록되었습니다.'
        });
        resetForm();
        fetchUsers();
      } else {
        setMessage({type: 'error', text: result.message || '처리 중 오류가 발생했습니다.'});
      }
    } catch (error: any) {
      console.error('사용자 등록/수정 오류:', error);
      setMessage({type: 'error', text: '서버 연결 오류가 발생했습니다.'});
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      name: '',
      phone: '',
      role: 'staff',
      site_id: '',
      user_id: '',
      is_active: true
    });
    setShowForm(false);
    setEditingUser(null);
  };

  const editUser = (user: User) => {
    setFormData({
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role as any,
      site_id: user.site_id,
      user_id: user.user_id,
      is_active: user.is_active
    });
    setEditingUser(user);
    setShowForm(true);
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/user-profiles/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      });

      const result = await response.json();
      if (result.success) {
        setMessage({
          type: 'success',
          text: `사용자가 ${!currentStatus ? '활성화' : '비활성화'}되었습니다.`
        });
        fetchUsers();
      } else {
        setMessage({type: 'error', text: result.message});
      }
    } catch (error) {
      setMessage({type: 'error', text: '상태 변경 중 오류가 발생했습니다.'});
    }
  };

  const deleteUser = async (userId: string, userName: string) => {
    if (!confirm(`정말로 "${userName}" 사용자를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/user-profiles/${userId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      if (result.success) {
        setMessage({type: 'success', text: '사용자가 삭제되었습니다.'});
        fetchUsers();
      } else {
        setMessage({type: 'error', text: result.message});
      }
    } catch (error) {
      setMessage({type: 'error', text: '사용자 삭제 중 오류가 발생했습니다.'});
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#1a202c',
          margin: 0
        }}>
          사용자 관리
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '12px 20px',
            backgroundColor: showForm ? '#6b7280' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {showForm ? '📋 사용자 목록' : '➕ 새 사용자 등록'}
        </button>
      </div>

      {message && (
        <div style={{
          padding: '16px',
          marginBottom: '20px',
          borderRadius: '8px',
          backgroundColor: message.type === 'success' ? '#dcfce7' : '#fef2f2',
          color: message.type === 'success' ? '#166534' : '#dc2626',
          border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`
        }}>
          {message.text}
        </div>
      )}

      {showForm ? (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid #e2e8f0'
        }}>
          <h4 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#1a202c',
            marginBottom: '20px'
          }}>
            {editingUser ? '사용자 정보 수정' : '새 사용자 등록'}
          </h4>

          <form onSubmit={handleSubmit}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px',
              marginBottom: '24px'
            }}>
              {/* 이메일 */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  이메일 <span style={{color: '#ef4444'}}>*</span>
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
                  placeholder="user@example.com"
                />
              </div>

              {/* 이름 */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  이름 <span style={{color: '#ef4444'}}>*</span>
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
                  placeholder="홍길동"
                />
              </div>

              {/* 전화번호 */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  전화번호 <span style={{color: '#ef4444'}}>*</span>
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
                  placeholder="010-1234-5678"
                />
              </div>

              {/* 권한 */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  권한 <span style={{color: '#ef4444'}}>*</span>
                </label>
                <select
                  required
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

              {/* 소속 사업장 */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  소속 사업장 <span style={{color: '#ef4444'}}>*</span>
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

              {/* 사번 */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  사번 <span style={{color: '#ef4444'}}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.user_id}
                  onChange={(e) => setFormData({...formData, user_id: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                  placeholder="EMP001"
                />
              </div>
            </div>

            {/* 활성화 상태 */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  style={{ marginRight: '8px' }}
                />
                활성화 상태
              </label>
            </div>

            {/* 버튼 */}
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={resetForm}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '12px 24px',
                  backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? '처리 중...' : editingUser ? '수정' : '등록'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p>로딩 중...</p>
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: '#6b7280' }}>등록된 사용자가 없습니다.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>이름</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>이메일</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>전화번호</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>권한</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>소속</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>사번</th>
                    <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>상태</th>
                    <th style={{ padding: '16px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: '#374151' }}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <tr key={user.id} style={{
                      borderTop: index > 0 ? '1px solid #e2e8f0' : 'none'
                    }}>
                      <td style={{ padding: '16px', fontSize: '14px', color: '#1a202c' }}>{user.name}</td>
                      <td style={{ padding: '16px', fontSize: '14px', color: '#1a202c' }}>{user.email}</td>
                      <td style={{ padding: '16px', fontSize: '14px', color: '#1a202c' }}>{user.phone_masked}</td>
                      <td style={{ padding: '16px', fontSize: '14px', color: '#1a202c' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: user.role === 'admin' ? '#fee2e2' : '#eff6ff',
                          color: user.role === 'admin' ? '#dc2626' : '#2563eb'
                        }}>
                          {user.role === 'admin' ? '관리자' : 
                           user.role === 'staff' ? '직원' : 
                           user.role === 'viewer' ? '조회만' : '아르바이트'}
                        </span>
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: '#1a202c' }}>{user.sites?.site_name || '-'}</td>
                      <td style={{ padding: '16px', fontSize: '14px', color: '#1a202c' }}>{user.user_id}</td>
                      <td style={{ padding: '16px', fontSize: '14px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: user.is_active ? '#dcfce7' : '#fef2f2',
                          color: user.is_active ? '#166534' : '#dc2626'
                        }}>
                          {user.is_active ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            onClick={() => editUser(user)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            수정
                          </button>
                          <button
                            onClick={() => toggleUserStatus(user.id, user.is_active)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: user.is_active ? '#f59e0b' : '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            {user.is_active ? '비활성화' : '활성화'}
                          </button>
                          <button
                            onClick={() => deleteUser(user.id, user.name)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}