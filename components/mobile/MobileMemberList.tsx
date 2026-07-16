'use client';

/**
 * 모바일 조합원 조회 — 통합 검색창 하나 + 간결한 목록(영농회/성명/생년월일/성별).
 * 검색 전에는 목록을 조회하지 않고, 행을 누르면 상세 모달을 띄운다.
 */

import React, { useState } from 'react';
import type { MemberOverview, MemberListResponse } from '@/types/member';
import { MemberDetailModal } from '@/components/admin/members/MemberDetailModal';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;

export function MobileMemberList() {
  const [members, setMembers] = useState<MemberOverview[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [detailMember, setDetailMember] = useState<MemberOverview | null>(null);

  const fetchMembers = async (targetPage: number, query: string) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: targetPage.toString(),
        page_size: PAGE_SIZE.toString(),
      });
      if (query) params.append('q', query);

      const response = await fetch(`/api/members?${params}`);
      const data: MemberListResponse = await response.json();

      if (response.ok) {
        setMembers(data.members);
        setTotal(data.total);
      } else {
        setError(data.error || '조합원 목록을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to fetch members:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
    setPage(1);
    fetchMembers(1, searchQuery);
  };

  const goPage = (p: number) => {
    setPage(p);
    fetchMembers(p, searchQuery);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* 통합 검색창 */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="성명 · 영농회 · 직책 검색"
          style={{
            flex: 1,
            padding: '11px 14px',
            border: '1px solid #d1d5db',
            borderRadius: '10px',
            fontSize: '15px',
            backgroundColor: 'white',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '0 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Search size={15} /> 검색
        </button>
      </form>

      {error && (
        <div
          style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            color: '#991b1b',
            padding: '10px 12px',
            borderRadius: '10px',
            fontSize: '14px',
            flexShrink: 0,
          }}
        >
          {error}
        </div>
      )}

      {/* 목록 */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          backgroundColor: 'white',
          borderRadius: '14px',
          border: '1px solid #f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {!hasSearched ? (
          <div style={emptyStyle}>검색어를 입력하고 검색 버튼을 눌러주세요.</div>
        ) : loading ? (
          <div style={emptyStyle}>로딩 중...</div>
        ) : members.length === 0 ? (
          <div style={emptyStyle}>조합원이 없습니다.</div>
        ) : (
          <>
            {/* 헤더 행 */}
            <div style={{ ...rowGridStyle, backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
              <span style={headerCellStyle}>영농회</span>
              <span style={headerCellStyle}>성명</span>
              <span style={headerCellStyle}>생년월일</span>
              <span style={{ ...headerCellStyle, textAlign: 'center' }}>성별</span>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => setDetailMember(member)}
                  style={{
                    ...rowGridStyle,
                    width: '100%',
                    backgroundColor: 'white',
                    border: 'none',
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ ...cellStyle, color: '#6b7280' }}>{member.association_name || '-'}</span>
                  <span style={{ ...cellStyle, fontWeight: 600 }}>{member.name}</span>
                  <span style={{ ...cellStyle, color: '#6b7280' }}>
                    {member.date_of_birth ? member.date_of_birth.split('T')[0] : '-'}
                  </span>
                  <span style={{ ...cellStyle, color: '#6b7280', textAlign: 'center' }}>{member.gender || '-'}</span>
                </button>
              ))}
            </div>

            {/* 페이지네이션 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderTop: '1px solid #e5e7eb',
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: '13px', color: '#6b7280' }}>
                총 {total}명 | {page} / {totalPages}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => goPage(Math.max(1, page - 1))} disabled={page === 1} style={pageBtnStyle(page === 1)}>
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => goPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  style={pageBtnStyle(page >= totalPages)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 상세 모달 */}
      <MemberDetailModal isOpen={detailMember !== null} onClose={() => setDetailMember(null)} member={detailMember} />
    </div>
  );
}

const emptyStyle: React.CSSProperties = {
  padding: '40px 16px',
  textAlign: 'center',
  color: '#6b7280',
  fontSize: '14px',
};

const rowGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 96px 40px',
  alignItems: 'center',
  gap: '8px',
  padding: '11px 14px',
};

const headerCellStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#374151',
};

const cellStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#1f2937',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const pageBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '6px 10px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  backgroundColor: disabled ? '#f3f4f6' : 'white',
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
});
