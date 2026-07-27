'use client';

import React, { useState, useEffect } from 'react';

interface Association {
  id: string;
  name: string;
  short_code?: string;
  chairman_name?: string;        // 영농회장
  women_chairman_name?: string;  // 부녀회장
  member_count?: number;         // 조합원 수 (탈퇴·비활성 제외)
  female_member_count?: number;  // 여성 조합원 수
  status: string;
  created_at: string;
  updated_at: string;
}

export function AssociationManagement() {
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAssociation, setEditingAssociation] = useState<Association | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    short_code: '',
    chairman_name: '',
    women_chairman_name: '',
    status: 'active' as 'active' | 'inactive'
  });

  // 데이터 로드
  const fetchAssociations = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/associations');
      const result = await response.json();

      if (result.success) {
        setAssociations(result.data);
      } else {
        setMessage({ type: 'error', text: result.message || '영농회 목록 조회에 실패했습니다.' });
      }
    } catch (error) {
      console.error('영농회 목록 조회 오류:', error);
      setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 등록/수정 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: '영농회명을 입력해주세요.' });
      return;
    }

    setLoading(true);
    try {
      const url = editingAssociation
        ? `/api/associations/${editingAssociation.id}`
        : '/api/associations';
      const method = editingAssociation ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({
          type: 'success',
          text: editingAssociation ? '영농회가 수정되었습니다.' : '영농회가 등록되었습니다.'
        });
        resetForm();
        fetchAssociations();
      } else {
        setMessage({ type: 'error', text: result.message || '작업에 실패했습니다.' });
      }
    } catch (error) {
      console.error('영농회 작업 오류:', error);
      setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 수정 모드
  const handleEdit = (association: Association) => {
    setEditingAssociation(association);
    setFormData({
      name: association.name,
      short_code: association.short_code || '',
      chairman_name: association.chairman_name || '',
      women_chairman_name: association.women_chairman_name || '',
      status: association.status as 'active' | 'inactive'
    });
    setShowForm(true);
  };

  // 삭제
  const handleDelete = async (association: Association) => {
    if (!confirm(`"${association.name}" 영농회를 정말 삭제하시겠습니까?\n\n주의: 소속 조합원이 있으면 삭제할 수 없습니다.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/associations/${association.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: '영농회가 삭제되었습니다.' });
        fetchAssociations();
      } else {
        setMessage({ type: 'error', text: result.message || '삭제에 실패했습니다.' });
      }
    } catch (error) {
      console.error('영농회 삭제 오류:', error);
      setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 폼 초기화
  const resetForm = () => {
    setShowForm(false);
    setEditingAssociation(null);
    setFormData({
      name: '',
      short_code: '',
      chairman_name: '',
      women_chairman_name: '',
      status: 'active'
    });
  };

  useEffect(() => {
    fetchAssociations();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div style={{ padding: '24px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1a202c', marginBottom: '8px' }}>
            영농회 관리
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '0' }}>
            조합원들이 소속된 영농회를 관리합니다.
          </p>
        </div>

        <button
          onClick={() => setShowForm(true)}
          disabled={loading}
          style={{
            backgroundColor: '#10b981',
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
          + 영농회 등록
        </button>
      </div>

      {/* 메시지 */}
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

      {/* 등록/수정 폼 */}
      {showForm && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#166534', margin: 0 }}>
              {editingAssociation ? '영농회 수정' : '새 영농회 등록'}
            </h4>
            <button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280' }}>
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>영농회명 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  style={inputStyle}
                  placeholder="예: 성주참외영농조합법인"
                />
              </div>

              <div>
                <label style={labelStyle}>단축 코드</label>
                <input
                  type="text"
                  value={formData.short_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, short_code: e.target.value.toUpperCase() }))}
                  style={inputStyle}
                  placeholder="예: SJCO"
                  maxLength={20}
                />
              </div>

              <div>
                <label style={labelStyle}>영농회장</label>
                <input
                  type="text"
                  value={formData.chairman_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, chairman_name: e.target.value }))}
                  style={inputStyle}
                  placeholder="영농회장 이름"
                />
              </div>

              <div>
                <label style={labelStyle}>부녀회장</label>
                <input
                  type="text"
                  value={formData.women_chairman_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, women_chairman_name: e.target.value }))}
                  style={inputStyle}
                  placeholder="부녀회장 이름"
                />
              </div>

              <div>
                <label style={labelStyle}>상태</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                  style={inputStyle}
                >
                  <option value="active">활성</option>
                  <option value="inactive">비활성</option>
                </select>
              </div>
            </div>

            {/* 버튼 */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={resetForm} disabled={loading} style={cancelButtonStyle}>
                취소
              </button>
              <button type="submit" disabled={loading} style={submitButtonStyle}>
                {loading ? '처리중...' : (editingAssociation ? '수정' : '등록')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 목록 */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ backgroundColor: '#f9fafb', padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1a202c', margin: 0 }}>
            영농회 목록 ({associations.length})
          </h4>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            데이터를 불러오는 중...
          </div>
        ) : associations.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            등록된 영농회가 없습니다.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={thStyle}>영농회명</th>
                  <th style={thStyle}>코드</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>조합원수</th>
                  <th style={thStyle}>영농회장</th>
                  <th style={thStyle}>부녀회장</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>상태</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {associations.map((assoc) => (
                  <tr key={assoc.id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: '500', color: '#1a202c' }}>{assoc.name}</div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        backgroundColor: '#ecfdf5',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        color: '#065f46',
                        fontWeight: '600'
                      }}>
                        {assoc.short_code || '-'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{ fontWeight: '600', color: '#1a202c' }}>{assoc.member_count ?? 0}</span>
                      <span style={{ color: '#9333ea' }}>({assoc.female_member_count ?? 0})</span>
                    </td>
                    <td style={tdStyle}>{assoc.chairman_name || '-'}</td>
                    <td style={tdStyle}>{assoc.women_chairman_name || '-'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: assoc.status === 'active' ? '#dcfce7' : '#fee2e2',
                        color: assoc.status === 'active' ? '#16a34a' : '#dc2626'
                      }}>
                        {assoc.status === 'active' ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button onClick={() => handleEdit(assoc)} disabled={loading} style={editBtnStyle}>
                          수정
                        </button>
                        <button onClick={() => handleDelete(assoc)} disabled={loading} style={deleteBtnStyle}>
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <td style={{ ...tdStyle, fontWeight: '600', color: '#1a202c' }}>합계</td>
                  <td style={tdStyle}></td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ fontWeight: '600', color: '#1a202c' }}>
                      {associations.reduce((sum, a) => sum + (a.member_count ?? 0), 0)}
                    </span>
                    <span style={{ color: '#9333ea' }}>
                      ({associations.reduce((sum, a) => sum + (a.female_member_count ?? 0), 0)})
                    </span>
                  </td>
                  <td style={tdStyle} colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: '500',
  color: '#374151',
  marginBottom: '4px'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '14px',
  boxSizing: 'border-box'
};

const cancelButtonStyle: React.CSSProperties = {
  backgroundColor: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  padding: '8px 16px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500'
};

const submitButtonStyle: React.CSSProperties = {
  backgroundColor: '#10b981',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  padding: '8px 16px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500'
};

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontWeight: '600',
  color: '#374151',
  borderBottom: '1px solid #e5e7eb'
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid #e5e7eb',
  color: '#6b7280'
};

const editBtnStyle: React.CSSProperties = {
  backgroundColor: 'transparent',
  color: '#10b981',
  border: '1px solid #10b981',
  borderRadius: '4px',
  padding: '4px 8px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: '500'
};

const deleteBtnStyle: React.CSSProperties = {
  backgroundColor: 'transparent',
  color: '#dc2626',
  border: '1px solid #dc2626',
  borderRadius: '4px',
  padding: '4px 8px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: '500'
};
