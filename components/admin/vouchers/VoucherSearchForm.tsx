'use client';

import React from 'react';

export function VoucherSearchForm() {
  return (
    <div>
      <h3 style={{
        fontSize: '20px',
        fontWeight: '600',
        color: '#1a202c',
        marginBottom: '16px'
      }}>
        교환권 조회
      </h3>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>
        발행된 교환권의 상태와 사용 내역을 조회합니다.
      </p>
      
      <div style={{
        border: '2px dashed #d1d5db',
        borderRadius: '8px',
        padding: '40px',
        textAlign: 'center',
        backgroundColor: '#f9fafb'
      }}>
        <p style={{ color: '#6b7280', fontSize: '16px' }}>
          🚧 교환권 조회 기능이 구현 예정입니다.
        </p>
      </div>
    </div>
  );
}