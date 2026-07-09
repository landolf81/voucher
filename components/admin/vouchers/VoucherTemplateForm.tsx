'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus } from 'lucide-react';

interface VoucherTemplate {
  id: string;
  voucher_name: string;
  voucher_type: string;
  expires_at: string;
  selected_sites: string[];
  notes: string;
  status: string;
}

interface Site {
  id: string;
  site_name: string;
}

export function VoucherTemplateForm() {
  const [templates, setTemplates] = useState<VoucherTemplate[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<VoucherTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const [formData, setFormData] = useState({
    voucher_name: '',
    voucher_type: 'fixed',
    expires_at: '',
    selected_sites: [] as string[],
    notes: ''
  });

  // 템플릿 목록 조회
  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/voucher-templates');
      const result = await response.json();
      if (result.success) {
        setTemplates(result.data || []);
      }
    } catch (error) {
      console.error('템플릿 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 사업장 목록 조회
  const fetchSites = async () => {
    try {
      const response = await fetch('/api/sites');
      const result = await response.json();
      if (result.success) {
        setSites(result.data || []);
      }
    } catch (error) {
      console.error('사업장 조회 오류:', error);
    }
  };


  // 템플릿 저장
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const requestData = {
        ...formData,
        status: 'active'
      };

      const url = editingTemplate 
        ? `/api/voucher-templates/${editingTemplate.id}`
        : '/api/voucher-templates';
      const method = editingTemplate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({
          type: 'success', 
          text: editingTemplate ? '교환권 정보가 수정되었습니다.' : '교환권 정보가 등록되었습니다.'
        });
        resetForm();
        fetchTemplates();
      } else {
        setMessage({type: 'error', text: result.message || '처리 중 오류가 발생했습니다.'});
      }
    } catch (error) {
      setMessage({type: 'error', text: '서버 연결 오류가 발생했습니다.'});
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      voucher_name: '',
      voucher_type: 'fixed',
      expires_at: '',
      selected_sites: [],
      notes: ''
    });
    setShowForm(false);
    setEditingTemplate(null);
  };

  const editTemplate = (template: VoucherTemplate) => {
    setFormData({
      voucher_name: template.voucher_name,
      voucher_type: template.voucher_type,
      expires_at: template.expires_at?.split('T')[0] || '',
      selected_sites: template.selected_sites || [],
      notes: template.notes || ''
    });
    setEditingTemplate(template);
    setShowForm(true);
  };

  const deleteTemplate = async (templateId: string, templateName: string) => {
    if (!confirm(`정말로 "${templateName}" 템플릿을 삭제하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/voucher-templates/${templateId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({
          type: 'success',
          text: '교환권 템플릿이 삭제되었습니다.'
        });
        fetchTemplates();
      } else {
        setMessage({
          type: 'error',
          text: result.message || '삭제 중 오류가 발생했습니다.'
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: '서버 연결 오류가 발생했습니다.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchSites();
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
          교환권 정보 관리
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
          {showForm ? <><ClipboardList size={16} /> 목록보기</> : <><Plus size={16} /> 새 교환권 등록</>}
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
        <form onSubmit={handleSubmit}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px',
            marginBottom: '24px'
          }}>
            {/* 교환권명 */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                교환권명 <span style={{color: '#ef4444'}}>*</span>
              </label>
              <input
                type="text"
                required
                value={formData.voucher_name}
                onChange={(e) => setFormData({...formData, voucher_name: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
                placeholder="교환권 이름을 입력하세요 (예: 쌀 10kg, 고구마 5kg)"
              />
            </div>

            {/* 교환권 구분 */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                교환권 구분 <span style={{color: '#ef4444'}}>*</span>
              </label>
              <select
                required
                value={formData.voucher_type}
                onChange={(e) => setFormData({...formData, voucher_type: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  color: '#374151'
                }}
              >
                <option value="fixed">고정형 (물품 교환)</option>
                <option value="cash">금액형 (금액 지급)</option>
              </select>
            </div>

            {/* 유효기간 */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                유효기간 <span style={{color: '#ef4444'}}>*</span>
              </label>
              <input
                type="date"
                required
                value={formData.expires_at}
                onChange={(e) => setFormData({...formData, expires_at: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
            </div>

          </div>

          {/* 적용 사업장 */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              적용 사업장 <span style={{color: '#ef4444'}}>*</span>
            </label>
            <div style={{
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              padding: '16px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {sites.map((site) => (
                <label key={site.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={formData.selected_sites.includes(site.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          selected_sites: [...formData.selected_sites, site.id]
                        });
                      } else {
                        setFormData({
                          ...formData,
                          selected_sites: formData.selected_sites.filter(id => id !== site.id)
                        });
                      }
                    }}
                    style={{ marginRight: '8px' }}
                  />
                  {site.site_name}
                </label>
              ))}
            </div>
          </div>

          {/* 비고 */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              비고
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '16px',
                minHeight: '100px',
                resize: 'vertical'
              }}
              placeholder="추가 정보를 입력하세요"
            />
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
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      ) : (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p>로딩 중...</p>
            </div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: '#6b7280' }}>등록된 교환권 템플릿이 없습니다.</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gap: '16px'
            }}>
              {templates.map((template) => (
                <div key={template.id} style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '20px',
                  backgroundColor: '#f9fafb'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px'
                  }}>
                    <div>
                      <h4 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#1a202c',
                        margin: 0
                      }}>
                        {template.voucher_name}
                      </h4>
                      <p style={{
                        fontSize: '14px',
                        color: '#6b7280',
                        margin: '4px 0 0 0'
                      }}>
                        {template.voucher_type === 'fixed' ? '고정형' : '금액형'} | 
                        유효기간: {template.expires_at?.split('T')[0]}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => editTemplate(template)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          cursor: 'pointer'
                        }}
                      >
                        수정
                      </button>
                      <button
                        onClick={() => deleteTemplate(template.id, template.voucher_name)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          cursor: 'pointer'
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  
                  {template.notes && (
                    <p style={{
                      fontSize: '14px',
                      color: '#4b5563',
                      margin: 0,
                      fontStyle: 'italic'
                    }}>
                      {template.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}