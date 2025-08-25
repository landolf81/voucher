'use client';

import React, { useState, useEffect } from 'react';
import { formatPhoneForDisplay, formatPhoneInput, cleanPhoneInput, getPhoneValidationMessage } from '@/lib/phone-utils';

interface Site {
  id: string;
  site_name: string;
  short_code?: string;
  address?: string;
  phone?: string;
  fax?: string;
  business_number?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function SiteManagement() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const [formData, setFormData] = useState({
    site_name: '',
    short_code: '',
    address: '',
    phone: '',
    fax: '',
    business_number: '',
    status: 'active' as 'active' | 'inactive'
  });

  // 사업장 목록 조회
  const fetchSites = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sites');
      const result = await response.json();
      
      if (result.success) {
        setSites(result.data);
      } else {
        setMessage({ type: 'error', text: result.message || '사업장 목록 조회에 실패했습니다.' });
      }
    } catch (error) {
      console.error('사업장 목록 조회 오류:', error);
      setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 사업장 등록/수정
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 필수 필드 검증
    if (!formData.site_name.trim()) {
      setMessage({ type: 'error', text: '사업장명을 입력해주세요.' });
      return;
    }

    // 전화번호 형식 검증
    if (formData.phone && !getPhoneValidationMessage(formData.phone)) {
      setMessage({ type: 'error', text: '올바른 전화번호를 입력해주세요.' });
      return;
    }

    // 팩스 형식 검증
    if (formData.fax && !getPhoneValidationMessage(formData.fax)) {
      setMessage({ type: 'error', text: '올바른 팩스번호를 입력해주세요.' });
      return;
    }

    setLoading(true);
    try {
      const submitData = {
        ...formData,
        phone: formData.phone ? cleanPhoneInput(formData.phone) : '',
        fax: formData.fax ? cleanPhoneInput(formData.fax) : ''
      };

      const url = editingSite ? `/api/sites/${editingSite.id}` : '/api/sites';
      const method = editingSite ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: editingSite ? '사업장이 수정되었습니다.' : '사업장이 등록되었습니다.' 
        });
        setShowForm(false);
        setEditingSite(null);
        setFormData({
          site_name: '',
          short_code: '',
          address: '',
          phone: '',
          fax: '',
          business_number: '',
          status: 'active'
        });
        fetchSites();
      } else {
        setMessage({ type: 'error', text: result.message || '작업에 실패했습니다.' });
      }
    } catch (error) {
      console.error('사업장 작업 오류:', error);
      setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 사업장 수정 모드
  const handleEdit = (site: Site) => {
    setEditingSite(site);
    setFormData({
      site_name: site.site_name,
      short_code: site.short_code || '',
      address: site.address || '',
      phone: site.phone ? formatPhoneForDisplay(site.phone) : '',
      fax: site.fax ? formatPhoneForDisplay(site.fax) : '',
      business_number: site.business_number || '',
      status: site.status as 'active' | 'inactive'
    });
    setShowForm(true);
  };

  // 폼 초기화
  const resetForm = () => {
    setShowForm(false);
    setEditingSite(null);
    setFormData({
      site_name: '',
      short_code: '',
      address: '',
      phone: '',
      fax: '',
      business_number: '',
      status: 'active'
    });
  };

  // 사업장 삭제
  const handleDelete = async (site: Site) => {
    if (!confirm(`"${site.site_name}" 사업장을 정말 삭제하시겠습니까?\n\n주의: 해당 사업장에 소속된 사용자가 있으면 삭제할 수 없습니다.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/sites/${site.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: 'success', text: '사업장이 삭제되었습니다.' });
        fetchSites();
      } else {
        setMessage({ type: 'error', text: result.message || '사업장 삭제에 실패했습니다.' });
      }
    } catch (error) {
      console.error('사업장 삭제 오류:', error);
      setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 전화번호 입력 처리
  const handlePhoneChange = (field: 'phone' | 'fax', value: string) => {
    const formatted = formatPhoneInput(value);
    setFormData(prev => ({
      ...prev,
      [field]: formatted
    }));
  };

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1a202c',
            marginBottom: '8px'
          }}>
            사업장 관리
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '0' }}>
            시스템에 등록된 사업장을 관리합니다.
          </p>
        </div>
        
        <button
          onClick={() => setShowForm(true)}
          disabled={loading}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            opacity: loading ? 0.6 : 1
          }}
        >
          + 사업장 등록
        </button>
      </div>

      {/* 메시지 표시 */}
      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '6px',
          marginBottom: '16px',
          backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: message.type === 'success' ? '#16a34a' : '#dc2626',
          border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`
        }}>
          {message.text}
        </div>
      )}

      {/* 사업장 등록/수정 폼 */}
      {showForm && (
        <div style={{
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1a202c', margin: 0 }}>
              {editingSite ? '사업장 수정' : '새 사업장 등록'}
            </h4>
            <button
              onClick={resetForm}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '0'
              }}
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  사업장명 *
                </label>
                <input
                  type="text"
                  value={formData.site_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, site_name: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="사업장명을 입력하세요"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  사업장 코드 *
                </label>
                <input
                  type="text"
                  value={formData.short_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, short_code: e.target.value.toUpperCase() }))}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="예: SITE01, HQ, BR01"
                  maxLength={10}
                />
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', margin: '4px 0 0 0' }}>
                  CSV 일괄 등록 시 사용할 고유 코드 (영문/숫자)
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  상태
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    color: '#374151'
                  }}
                >
                  <option value="active">활성</option>
                  <option value="inactive">비활성</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                주소
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
                placeholder="주소를 입력하세요"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  전화번호
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => handlePhoneChange('phone', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="010-1234-5678"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  팩스번호
                </label>
                <input
                  type="text"
                  value={formData.fax}
                  onChange={(e) => handlePhoneChange('fax', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="02-1234-5678"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  사업자번호
                </label>
                <input
                  type="text"
                  value={formData.business_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, business_number: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="123-45-67890"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                style={{
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: loading ? 0.6 : 1
                }}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? '처리중...' : (editingSite ? '수정' : '등록')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 사업장 목록 */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <div style={{
          backgroundColor: '#f9fafb',
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1a202c', margin: 0 }}>
            사업장 목록 ({sites.length})
          </h4>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            데이터를 불러오는 중...
          </div>
        ) : sites.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            등록된 사업장이 없습니다.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    사업장명
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    코드
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    주소
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    전화번호
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    팩스번호
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    사업자번호
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    상태
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    작업
                  </th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => (
                  <tr key={site.id}>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                      <div style={{ fontWeight: '500', color: '#1a202c' }}>{site.site_name}</div>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                      <span style={{ 
                        backgroundColor: '#f3f4f6', 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        color: '#1f2937',
                        fontWeight: '600'
                      }}>
                        {site.short_code || '미설정'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                      {site.address || '-'}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                      {site.phone ? formatPhoneForDisplay(site.phone) : '-'}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                      {site.fax ? formatPhoneForDisplay(site.fax) : '-'}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                      {site.business_number || '-'}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: site.status === 'active' ? '#dcfce7' : '#fee2e2',
                        color: site.status === 'active' ? '#16a34a' : '#dc2626'
                      }}>
                        {site.status === 'active' ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleEdit(site)}
                          disabled={loading}
                          style={{
                            backgroundColor: 'transparent',
                            color: '#3b82f6',
                            border: '1px solid #3b82f6',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            fontWeight: '500',
                            opacity: loading ? 0.6 : 1
                          }}
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(site)}
                          disabled={loading}
                          style={{
                            backgroundColor: 'transparent',
                            color: '#dc2626',
                            border: '1px solid #dc2626',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            fontWeight: '500',
                            opacity: loading ? 0.6 : 1
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
    </div>
  );
}