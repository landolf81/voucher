'use client';

import React, { useState, useEffect } from 'react';
import type { MemberOverview, MemberListResponse, Crop } from '@/types/member';
import { MemberFormModal } from './MemberFormModal';
import { MemberDetailModal } from './MemberDetailModal';
import { getSupabaseClient } from '@/lib/supabase';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

const POSITION_PRESETS = ['조합장', '대의원', '비상임이사', '비상임감사', '영농회장', '부녀회장'];

interface Association {
  id: string;
  name: string;
}

export function MemberManagement() {
  const [members, setMembers] = useState<MemberOverview[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssociation, setSelectedAssociation] = useState('');
  const [selectedCrop, setSelectedCrop] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [positionOptions, setPositionOptions] = useState<string[]>(POSITION_PRESETS);

  // Master data
  const [associations, setAssociations] = useState<Association[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailMember, setDetailMember] = useState<MemberOverview | null>(null);
  const [editingMember, setEditingMember] = useState<MemberOverview | null>(null);

  useEffect(() => {
    fetchAssociations();
    fetchCrops();
    fetchPositionOptions();
  }, []);

  // 첫 진입 시에는 조회하지 않고, 검색 버튼을 누른 이후부터 필터·페이지 변경 시 재조회
  useEffect(() => {
    if (!hasSearched) return;
    fetchMembers();
  }, [hasSearched, page, selectedAssociation, selectedCrop, selectedPosition]);

  // 직접 입력으로 등록된 직책도 필터 목록에 포함
  const fetchPositionOptions = async () => {
    try {
      const supabase = getSupabaseClient() as any;
      const { data } = await supabase.from('member_positions').select('position');
      const inDb: string[] = [...new Set(((data || []) as { position: string }[]).map(r => r.position))];
      const extras = inDb.filter(p => !POSITION_PRESETS.includes(p)).sort();
      setPositionOptions([...POSITION_PRESETS, ...extras]);
    } catch (error) {
      console.error('Failed to fetch position options:', error);
    }
  };

  const fetchAssociations = async () => {
    try {
      const response = await fetch('/api/associations');
      const data = await response.json();
      if (data.success && data.data) {
        setAssociations(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch associations:', error);
    }
  };

  const fetchCrops = async () => {
    try {
      const response = await fetch('/api/crops');
      const data = await response.json();
      if (data.crops) {
        setCrops(data.crops);
      }
    } catch (error) {
      console.error('Failed to fetch crops:', error);
    }
  };

  const fetchMembers = async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });

      if (searchQuery) params.append('q', searchQuery);
      if (selectedAssociation) params.append('association_id', selectedAssociation);
      if (selectedCrop) params.append('crop_id', selectedCrop);
      if (selectedPosition) params.append('position', selectedPosition);

      const response = await fetch(`/api/members?${params}`);
      const data: MemberListResponse = await response.json();

      if (response.ok) {
        setMembers(data.members);
        setTotal(data.total);
      } else {
        setError(data.error || '조합원 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSearched) {
      setHasSearched(true); // useEffect가 첫 조회를 수행
      return;
    }
    if (page !== 1) {
      setPage(1); // 페이지 변경이 useEffect로 재조회를 유발
    } else {
      fetchMembers();
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#1a202c',
          margin: 0
        }}>
          조합원 관리
        </h2>
        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          + 조합원 등록
        </button>
      </div>

      {/* 조합원 등록/수정 모달 */}
      <MemberFormModal
        isOpen={isModalOpen || editingMember !== null}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMember(null);
        }}
        onSuccess={() => {
          fetchMembers();
          setIsModalOpen(false);
          setEditingMember(null);
        }}
        associations={associations}
        crops={crops}
        editingMember={editingMember ?? undefined}
      />

      {/* 조합원 상세보기 모달 */}
      <MemberDetailModal
        isOpen={detailMember !== null}
        onClose={() => setDetailMember(null)}
        member={detailMember}
        onEdit={() => {
          setEditingMember(detailMember);
          setDetailMember(null);
        }}
      />

      {/* Filters */}
      <form onSubmit={handleSearch} style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '16px'
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '6px'
            }}>
              검색 (성명/영농회/직책)
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="검색어 입력"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '6px'
            }}>
              영농회
            </label>
            <select
              value={selectedAssociation}
              onChange={(e) => setSelectedAssociation(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="">전체</option>
              {associations.map(assoc => (
                <option key={assoc.id} value={assoc.id}>
                  {assoc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '6px'
            }}>
              작물
            </label>
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="">전체</option>
              {crops.map(crop => (
                <option key={crop.id} value={crop.id}>
                  {crop.crop_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '6px'
            }}>
              직책 (재임 중)
            </label>
            <select
              value={selectedPosition}
              onChange={(e) => { setSelectedPosition(e.target.value); setPage(1); }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="">전체</option>
              {positionOptions.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Search size={14} /> 검색
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#991b1b',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {!hasSearched ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            검색 버튼을 눌러 조합원 목록을 조회하세요.
          </div>
        ) : loading ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            로딩 중...
          </div>
        ) : members.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            조합원이 없습니다.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={tableHeaderStyle}>증권번호</th>
                    <th style={tableHeaderStyle}>성명</th>
                    <th style={tableHeaderStyle}>영농회</th>
                    <th style={tableHeaderStyle}>주작물</th>
                    <th style={tableHeaderStyle}>생년월일</th>
                    <th style={tableHeaderStyle}>성별</th>
                    <th style={tableHeaderStyle}>가입일자</th>
                    <th style={tableHeaderStyle}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(member => (
                    <tr key={member.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={tableCellStyle}>{member.security_number || '-'}</td>
                      <td style={tableCellStyle}>{member.name}</td>
                      <td style={tableCellStyle}>{member.association_name || '-'}</td>
                      <td style={tableCellStyle}>{member.main_crop_name || '-'}</td>
                      <td style={tableCellStyle}>{member.date_of_birth ? member.date_of_birth.split('T')[0] : '-'}</td>
                      <td style={tableCellStyle}>{member.gender || '-'}</td>
                      <td style={tableCellStyle}>{member.join_date ? member.join_date.split('T')[0] : '-'}</td>
                      <td style={tableCellStyle}>
                        <button
                          onClick={() => setDetailMember(member)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            backgroundColor: '#e0e7ff',
                            color: '#3730a3',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginRight: '6px'
                          }}
                        >
                          상세
                        </button>
                        <button
                          onClick={() => setEditingMember(member)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          수정
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                총 {total}명 | 페이지 {page} / {totalPages}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: page === 1 ? '#f3f4f6' : 'white',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: page === totalPages ? '#f3f4f6' : 'white',
                    cursor: page === totalPages ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const tableHeaderStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '13px',
  fontWeight: '600',
  color: '#374151',
  whiteSpace: 'nowrap'
};

const tableCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '14px',
  color: '#1f2937',
  whiteSpace: 'nowrap'
};
