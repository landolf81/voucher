'use client';

import React from 'react';

interface VoucherData {
  id: string;
  serial_no: string;
  amount: number;
  association: string;
  member_id: string;
  name: string;
  dob: string;
  phone?: string;
  status: string;
  issued_at: string;
  used_at?: string;
  usage_location?: string;
  used_by_user_id?: string;
  used_at_site_id?: string;
  notes?: string;
  template_id?: string;
}

interface Props {
  vouchers: VoucherData[];
  loading: boolean;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  sortBy: 'issued_at' | 'used_at' | 'amount' | 'status';
  sortOrder: 'asc' | 'desc';
  onSort: (field: 'issued_at' | 'used_at' | 'amount' | 'status') => void;
  onViewDetail: (voucher: VoucherData) => void;
  onPageChange: (page: number) => void;
  onDelete?: (voucher: VoucherData) => void;
  onReissue?: (voucher: VoucherData) => void;
}

export function VoucherInquiryTable({
  vouchers,
  loading,
  currentPage,
  totalPages,
  totalCount,
  sortBy,
  sortOrder,
  onSort,
  onViewDetail,
  onPageChange,
  onDelete,
  onReissue
}: Props) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'registered': return { bg: '#f3f4f6', color: '#6b7280' };
      case 'issued': return { bg: '#dcfce7', color: '#16a34a' };
      case 'used': return { bg: '#fef3c7', color: '#d97706' };
      case 'recalled': return { bg: '#dbeafe', color: '#2563eb' };
      case 'disposed': return { bg: '#fee2e2', color: '#dc2626' };
      default: return { bg: '#f3f4f6', color: '#6b7280' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'registered': return '등록됨';
      case 'issued': return '발행됨';
      case 'used': return '사용됨';
      case 'recalled': return '회수됨';
      case 'disposed': return '폐기됨';
      default: return status;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  const SortIcon = ({ field }: { field: typeof sortBy }) => {
    if (sortBy !== field) {
      return <span style={{ opacity: 0.3 }}>↕️</span>;
    }
    return <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  if (loading) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '48px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        데이터를 불러오는 중...
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'hidden'
    }}>
      {/* 테이블 헤더 */}
      <div style={{
        padding: '16px 24px',
        backgroundColor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: '600',
          color: '#1a202c',
          margin: 0
        }}>
          검색 결과
        </h3>
        <span style={{
          fontSize: '14px',
          color: '#6b7280'
        }}>
          총 {totalCount.toLocaleString()}건
        </span>
      </div>

      {/* 테이블 */}
      {vouchers.length === 0 ? (
        <div style={{
          padding: '48px',
          textAlign: 'center',
          color: '#6b7280'
        }}>
          검색 결과가 없습니다.
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    일련번호
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    이름
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    영농회
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'right',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                  onClick={() => onSort('amount')}
                  >
                    금액 <SortIcon field="amount" />
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                  onClick={() => onSort('status')}
                  >
                    상태 <SortIcon field="status" />
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                  onClick={() => onSort('issued_at')}
                  >
                    발행일 <SortIcon field="issued_at" />
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                  onClick={() => onSort('used_at')}
                  >
                    사용일 <SortIcon field="used_at" />
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    사용처
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    관리
                  </th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((voucher) => {
                  const statusStyle = getStatusColor(voucher.status);
                  return (
                    <tr key={voucher.id}>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '14px',
                        fontFamily: 'monospace'
                      }}>
                        {voucher.serial_no}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}>
                        {voucher.name}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '14px',
                        color: '#6b7280'
                      }}>
                        {voucher.association}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '14px',
                        textAlign: 'right',
                        fontWeight: '500'
                      }}>
                        {formatAmount(voucher.amount)}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        textAlign: 'center'
                      }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.color
                        }}>
                          {getStatusLabel(voucher.status)}
                        </span>
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '13px',
                        color: '#6b7280',
                        textAlign: 'center'
                      }}>
                        {formatDate(voucher.issued_at)}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '13px',
                        color: '#6b7280',
                        textAlign: 'center'
                      }}>
                        {formatDate(voucher.used_at)}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '14px',
                        color: '#6b7280'
                      }}>
                        {voucher.usage_location || '-'}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        textAlign: 'center'
                      }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button
                            onClick={() => onViewDetail(voucher)}
                            style={{
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}
                          >
                            상세
                          </button>
                          {onReissue && (voucher.status === 'registered' || voucher.status === 'issued') && (
                            <button
                              onClick={() => onReissue(voucher)}
                              style={{
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '500'
                              }}
                            >
                              재발행
                            </button>
                          )}
                          {onDelete && voucher.status !== 'used' && (
                            <button
                              onClick={() => {
                                if (confirm(`교환권 ${voucher.serial_no}를 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.`)) {
                                  onDelete(voucher);
                                }
                              }}
                              style={{
                                backgroundColor: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '500'
                              }}
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div style={{
              padding: '16px 24px',
              backgroundColor: '#f9fafb',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{
                fontSize: '14px',
                color: '#6b7280'
              }}>
                페이지 {currentPage} / {totalPages}
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => onPageChange(1)}
                  disabled={currentPage === 1}
                  style={{
                    backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
                    color: currentPage === 1 ? '#9ca3af' : '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    padding: '6px 8px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '12px'
                  }}
                >
                  ⏮️
                </button>
                
                <button
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
                    color: currentPage === 1 ? '#9ca3af' : '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '12px'
                  }}
                >
                  이전
                </button>

                {/* 페이지 번호 */}
                {Array.from(
                  { length: Math.min(5, totalPages) },
                  (_, i) => {
                    const start = Math.max(1, currentPage - 2);
                    const pageNum = start + i;
                    if (pageNum > totalPages) return null;
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => onPageChange(pageNum)}
                        style={{
                          backgroundColor: pageNum === currentPage ? '#3b82f6' : 'white',
                          color: pageNum === currentPage ? 'white' : '#374151',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          padding: '6px 10px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: pageNum === currentPage ? '600' : '400'
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                ).filter(Boolean)}

                <button
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{
                    backgroundColor: currentPage === totalPages ? '#f3f4f6' : 'white',
                    color: currentPage === totalPages ? '#9ca3af' : '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '12px'
                  }}
                >
                  다음
                </button>
                
                <button
                  onClick={() => onPageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  style={{
                    backgroundColor: currentPage === totalPages ? '#f3f4f6' : 'white',
                    color: currentPage === totalPages ? '#9ca3af' : '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    padding: '6px 8px',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '12px'
                  }}
                >
                  ⏭️
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}