'use client';

import React from 'react';

interface SearchFilters {
  serial_no: string;
  name: string;
  association: string;
  member_id: string;
  status: string;
  template_id: string;
  date_from: string;
  date_to: string;
  date_type: 'issued' | 'used';
}

interface VoucherTemplate {
  id: string;
  voucher_name: string;
  voucher_type: string;
  status: string;
}

interface Props {
  filters: SearchFilters;
  templates: VoucherTemplate[];
  onFilterChange: (filters: SearchFilters) => void;
  onSearch: () => void;
  onReset: () => void;
}

export function VoucherSearchFilters({ filters, templates, onFilterChange, onSearch, onReset }: Props) {
  const handleChange = (field: keyof SearchFilters, value: string) => {
    onFilterChange({
      ...filters,
      [field]: value
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      marginBottom: '24px'
    }}>
      <h3 style={{
        fontSize: '18px',
        fontWeight: '600',
        color: '#1a202c',
        marginBottom: '16px'
      }}>
        검색 필터
      </h3>

      {/* 첫 번째 줄: 기본 검색 필드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '4px'
          }}>
            일련번호
          </label>
          <input
            type="text"
            value={filters.serial_no}
            onChange={(e) => handleChange('serial_no', e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="일련번호 입력"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '4px'
          }}>
            이름
          </label>
          <input
            type="text"
            value={filters.name}
            onChange={(e) => handleChange('name', e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="이름 입력"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '4px'
          }}>
            영농회
          </label>
          <input
            type="text"
            value={filters.association}
            onChange={(e) => handleChange('association', e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="영농회 입력"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '4px'
          }}>
            조합원ID
          </label>
          <input
            type="text"
            value={filters.member_id}
            onChange={(e) => handleChange('member_id', e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="조합원ID 입력"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* 두 번째 줄: 상태, 템플릿, 날짜 필터 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '4px'
          }}>
            상태
          </label>
          <select
            value={filters.status}
            onChange={(e) => handleChange('status', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'white',
              color: '#374151',
              boxSizing: 'border-box'
            }}
          >
            <option value="">전체</option>
            <option value="registered">등록됨</option>
            <option value="issued">발행됨</option>
            <option value="used">사용됨</option>
            <option value="recalled">회수됨</option>
            <option value="disposed">폐기됨</option>
          </select>
        </div>

        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '4px'
          }}>
            교환권 템플릿
          </label>
          <select
            value={filters.template_id}
            onChange={(e) => handleChange('template_id', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'white',
              color: '#374151',
              boxSizing: 'border-box'
            }}
          >
            <option value="">전체</option>
            {templates.filter(t => t.status === 'active').map((template) => (
              <option key={template.id} value={template.id}>
                {template.voucher_name} ({template.voucher_type})
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
            marginBottom: '4px'
          }}>
            날짜 기준
          </label>
          <select
            value={filters.date_type}
            onChange={(e) => handleChange('date_type', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'white',
              color: '#374151',
              boxSizing: 'border-box'
            }}
          >
            <option value="issued">발행일 기준</option>
            <option value="used">사용일 기준</option>
          </select>
        </div>

        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '4px'
          }}>
            시작 날짜
          </label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => handleChange('date_from', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '4px'
          }}>
            종료 날짜
          </label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => handleChange('date_to', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* 버튼 그룹 */}
      <div style={{
        display: 'flex',
        gap: '8px',
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={onReset}
          style={{
            backgroundColor: '#f3f4f6',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          초기화
        </button>
        <button
          onClick={onSearch}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          🔍 검색
        </button>
      </div>
    </div>
  );
}