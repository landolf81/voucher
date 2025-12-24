'use client';

import React, { useState, useEffect } from 'react';

interface Site {
  id: string;
  site_name: string;
  short_code: string | null;
  status?: string;
}

interface SiteCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdminMode?: boolean; // 관리자 모드에서는 편집 가능
}

export function SiteCodeModal({ isOpen, onClose, isAdminMode = false }: SiteCodeModalProps) {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCode, setEditingCode] = useState<{id: string, code: string} | null>(null);
  const [saving, setSaving] = useState(false);

  // 사업장 코드 목록 조회
  const fetchSiteCodes = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sites/codes');
      const data = await response.json();
      
      if (data.success) {
        setSites(data.data || []);
      } else {
        console.error('사업장 코드 조회 실패:', data.message);
      }
    } catch (error) {
      console.error('사업장 코드 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 사업장 코드 업데이트 (관리자 전용)
  const updateSiteCode = async (siteId: string, newCode: string) => {
    if (!newCode.trim()) {
      alert('코드를 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/sites/codes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          site_id: siteId,
          short_code: newCode.trim()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // 성공 시 목록 새로고침
        await fetchSiteCodes();
        setEditingCode(null);
        alert('코드가 성공적으로 업데이트되었습니다.');
      } else {
        alert(data.message || '코드 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('코드 업데이트 오류:', error);
      alert('서버 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 사업장 코드 제거 (관리자 전용)
  const removeSiteCode = async (siteId: string) => {
    if (!confirm('정말로 이 코드를 제거하시겠습니까?')) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/sites/codes?site_id=${siteId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        // 성공 시 목록 새로고침
        await fetchSiteCodes();
        alert('코드가 성공적으로 제거되었습니다.');
      } else {
        alert(data.message || '코드 제거에 실패했습니다.');
      }
    } catch (error) {
      console.error('코드 제거 오류:', error);
      alert('서버 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 모달이 열릴 때 데이터 로드
  useEffect(() => {
    if (isOpen) {
      fetchSiteCodes();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            margin: 0
          }}>
            📋 사업장 코드표
          </h3>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ×
          </button>
        </div>

        {/* 안내 문구 */}
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px'
        }}>
          <p style={{
            fontSize: '13px',
            color: '#0369a1',
            margin: 0
          }}>
            CSV 파일에서 사용할 수 있는 사업장 코드 목록입니다. 
            {isAdminMode ? ' 관리자 권한으로 코드를 편집할 수 있습니다.' : ''}
          </p>
        </div>

        {/* 로딩 */}
        {loading && (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: '#6b7280'
          }}>
            로딩 중...
          </div>
        )}

        {/* 사업장 코드 목록 */}
        {!loading && (
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            {/* 헤더 */}
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '12px',
              borderBottom: '1px solid #e5e7eb',
              display: 'grid',
              gridTemplateColumns: isAdminMode ? '2fr 1fr 100px' : '2fr 1fr',
              gap: '12px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#374151'
            }}>
              <div>사업장명</div>
              <div>코드</div>
              {isAdminMode && <div>관리</div>}
            </div>

            {/* 데이터 행 */}
            {sites.map((site) => (
              <div
                key={site.id}
                style={{
                  padding: '12px',
                  borderBottom: sites.indexOf(site) === sites.length - 1 ? 'none' : '1px solid #e5e7eb',
                  display: 'grid',
                  gridTemplateColumns: isAdminMode ? '2fr 1fr 100px' : '2fr 1fr',
                  gap: '12px',
                  alignItems: 'center',
                  fontSize: '14px'
                }}
              >
                <div style={{ color: '#1f2937' }}>
                  {site.site_name}
                  {site.status === 'inactive' && (
                    <span style={{
                      fontSize: '11px',
                      color: '#dc2626',
                      marginLeft: '8px'
                    }}>
                      (비활성)
                    </span>
                  )}
                </div>
                <div>
                  {editingCode?.id === site.id ? (
                    <input
                      type="text"
                      value={editingCode.code}
                      onChange={(e) => setEditingCode({
                        id: site.id,
                        code: e.target.value.toUpperCase()
                      })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          updateSiteCode(site.id, editingCode.code);
                        } else if (e.key === 'Escape') {
                          setEditingCode(null);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                      placeholder="코드 입력"
                      autoFocus
                    />
                  ) : (
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: site.short_code ? '#059669' : '#9ca3af',
                      padding: '4px 8px',
                      backgroundColor: site.short_code ? '#f0fdf4' : '#f9fafb',
                      borderRadius: '4px'
                    }}>
                      {site.short_code || '미설정'}
                    </span>
                  )}
                </div>
                {isAdminMode && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {editingCode?.id === site.id ? (
                      <>
                        <button
                          onClick={() => updateSiteCode(site.id, editingCode.code)}
                          disabled={saving}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#059669',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: saving ? 'wait' : 'pointer'
                          }}
                        >
                          저장
                        </button>
                        <button
                          onClick={() => setEditingCode(null)}
                          disabled={saving}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          취소
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditingCode({
                            id: site.id,
                            code: site.short_code || ''
                          })}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          편집
                        </button>
                        {site.short_code && (
                          <button
                            onClick={() => removeSiteCode(site.id)}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                          >
                            제거
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}

            {sites.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '20px',
                color: '#6b7280'
              }}>
                사업장이 없습니다.
              </div>
            )}
          </div>
        )}

        {/* 통계 정보 */}
        {!loading && sites.length > 0 && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#6b7280'
          }}>
            총 사업장: {sites.length}개 | 
            코드 설정: {sites.filter(s => s.short_code).length}개 | 
            미설정: {sites.filter(s => !s.short_code).length}개
          </div>
        )}

        {/* 닫기 버튼 */}
        <div style={{
          textAlign: 'center',
          marginTop: '20px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}