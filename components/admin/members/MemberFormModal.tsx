'use client';

import React, { useState, useEffect } from 'react';
import type { MemberFormData, Crop } from '@/types/member';

interface Association {
  id: string;
  name: string;
}

interface MemberFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  associations: Association[];
  crops: Crop[];
  editingMember?: MemberFormData & { id: string };
}

export function MemberFormModal({
  isOpen,
  onClose,
  onSuccess,
  associations,
  crops,
  editingMember
}: MemberFormModalProps) {
  const [formData, setFormData] = useState<MemberFormData>({
    site_id: '',
    association_id: '',
    name: '',
    member_id: '',
    security_number: '',
    date_of_birth: '',
    phone: '',
    address: '',
    join_date: '',
    leave_date: '',
    main_crop_id: '',
    sub_crop_id: '',
    grafting_workplace_address: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 편집 모드일 때 데이터 로드
  useEffect(() => {
    if (editingMember) {
      setFormData({
        site_id: editingMember.site_id || '',
        association_id: editingMember.association_id || '',
        name: editingMember.name || '',
        member_id: editingMember.member_id || '',
        security_number: editingMember.security_number || '',
        date_of_birth: editingMember.date_of_birth || '',
        phone: editingMember.phone || '',
        address: editingMember.address || '',
        join_date: editingMember.join_date || '',
        leave_date: editingMember.leave_date || '',
        main_crop_id: editingMember.main_crop_id || '',
        sub_crop_id: editingMember.sub_crop_id || '',
        grafting_workplace_address: editingMember.grafting_workplace_address || ''
      });
    } else {
      // 새 등록 시 초기화
      setFormData({
        site_id: '',
        association_id: associations.length === 1 ? associations[0].id : '',
        name: '',
        member_id: '',
        security_number: '',
        date_of_birth: '',
        phone: '',
        address: '',
        join_date: new Date().toISOString().split('T')[0],
        leave_date: '',
        main_crop_id: '',
        sub_crop_id: '',
        grafting_workplace_address: ''
      });
    }
    setError('');
  }, [editingMember, isOpen, associations]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 증권번호 포맷팅 (733054-0-000000)
  const handleSecurityNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^0-9-]/g, '');
    setFormData(prev => ({ ...prev, security_number: value }));
  };

  const validateForm = (): boolean => {
    if (!formData.association_id) {
      setError('영농회를 선택해주세요.');
      return false;
    }
    if (!formData.name.trim()) {
      setError('성명을 입력해주세요.');
      return false;
    }
    if (!formData.member_id.trim()) {
      setError('조합원 ID를 입력해주세요.');
      return false;
    }
    if (!formData.date_of_birth) {
      setError('생년월일을 입력해주세요.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setLoading(true);

    try {
      const url = editingMember
        ? `/api/members/${editingMember.id}`
        : '/api/members';

      const method = editingMember ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member: {
            ...formData,
            // 빈 문자열을 null로 변환
            site_id: formData.site_id || null,
            association_id: formData.association_id || null,
            security_number: formData.security_number || null,
            phone: formData.phone || null,
            address: formData.address || null,
            join_date: formData.join_date || null,
            leave_date: formData.leave_date || null,
            main_crop_id: formData.main_crop_id || null,
            sub_crop_id: formData.sub_crop_id || null,
            grafting_workplace_address: formData.grafting_workplace_address || null
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '조합원 등록에 실패했습니다.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || '서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

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
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0, color: '#1f2937' }}>
            {editingMember ? '조합원 정보 수정' : '조합원 등록'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '24px' }}>
            {error && (
              <div style={{
                backgroundColor: '#fee2e2',
                border: '1px solid #fca5a5',
                color: '#991b1b',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            {/* 기본 정보 섹션 */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '16px',
                paddingBottom: '8px',
                borderBottom: '2px solid #3b82f6'
              }}>
                기본 정보
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* 영농회 */}
                <div>
                  <label style={labelStyle}>
                    영농회 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    name="association_id"
                    value={formData.association_id}
                    onChange={handleChange}
                    style={inputStyle}
                    required
                  >
                    <option value="">선택하세요</option>
                    {associations.map(assoc => (
                      <option key={assoc.id} value={assoc.id}>{assoc.name}</option>
                    ))}
                  </select>
                </div>

                {/* 조합원 ID */}
                <div>
                  <label style={labelStyle}>
                    조합원 ID <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="member_id"
                    value={formData.member_id}
                    onChange={handleChange}
                    placeholder="예: 001"
                    style={inputStyle}
                    required
                  />
                </div>

                {/* 성명 */}
                <div>
                  <label style={labelStyle}>
                    성명 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="홍길동"
                    style={inputStyle}
                    required
                  />
                </div>

                {/* 생년월일 */}
                <div>
                  <label style={labelStyle}>
                    생년월일 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                    style={inputStyle}
                    required
                  />
                </div>

                {/* 증권번호 */}
                <div>
                  <label style={labelStyle}>증권번호</label>
                  <input
                    type="text"
                    name="security_number"
                    value={formData.security_number}
                    onChange={handleSecurityNumberChange}
                    placeholder="733054-0-000000"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* 영농 정보 섹션 */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '16px',
                paddingBottom: '8px',
                borderBottom: '2px solid #10b981'
              }}>
                영농 정보
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* 주작물 */}
                <div>
                  <label style={labelStyle}>주작물</label>
                  <select
                    name="main_crop_id"
                    value={formData.main_crop_id}
                    onChange={handleChange}
                    style={inputStyle}
                  >
                    <option value="">선택하세요</option>
                    {crops.map(crop => (
                      <option key={crop.id} value={crop.id}>{crop.crop_name}</option>
                    ))}
                  </select>
                </div>

                {/* 부작물 */}
                <div>
                  <label style={labelStyle}>부작물</label>
                  <select
                    name="sub_crop_id"
                    value={formData.sub_crop_id}
                    onChange={handleChange}
                    style={inputStyle}
                  >
                    <option value="">선택하세요</option>
                    {crops.map(crop => (
                      <option key={crop.id} value={crop.id}>{crop.crop_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 접목 작업장 주소 */}
              <div style={{ marginTop: '16px' }}>
                <label style={labelStyle}>접목 작업장 주소</label>
                <input
                  type="text"
                  name="grafting_workplace_address"
                  value={formData.grafting_workplace_address}
                  onChange={handleChange}
                  placeholder="접목 작업이 필요한 경우 작업장 주소 입력"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* 가입 정보 섹션 */}
            <div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '16px',
                paddingBottom: '8px',
                borderBottom: '2px solid #f59e0b'
              }}>
                가입 정보
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* 가입일자 */}
                <div>
                  <label style={labelStyle}>가입일자</label>
                  <input
                    type="date"
                    name="join_date"
                    value={formData.join_date}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </div>

                {/* 탈퇴일자 */}
                <div>
                  <label style={labelStyle}>탈퇴일자</label>
                  <input
                    type="date"
                    name="leave_date"
                    value={formData.leave_date}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '20px 24px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 24px',
                backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? '처리 중...' : (editingMember ? '수정' : '등록')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: '500',
  color: '#374151',
  marginBottom: '6px'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box'
};
