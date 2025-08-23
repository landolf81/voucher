'use client';

import React from 'react';
import * as QRCode from 'qrcode';
import { useEffect, useState } from 'react';

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
  voucher_templates?: {
    voucher_name: string;
    voucher_type: string;
  };
}

interface Props {
  voucher: VoucherData;
  onClose: () => void;
}

export function VoucherDetailModal({ voucher, onClose }: Props) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    // QR 코드 생성
    QRCode.toDataURL(voucher.serial_no, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    }).then(url => {
      setQrCodeUrl(url);
    });
  }, [voucher.serial_no]);

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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const statusStyle = getStatusColor(voucher.status);

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
        borderRadius: '12px',
        padding: '32px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* 헤더 */}
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
            교환권 상세 정보
          </h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              fontSize: '24px',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* QR 코드 및 상태 */}
        <div style={{
          display: 'flex',
          gap: '24px',
          marginBottom: '24px',
          alignItems: 'center'
        }}>
          {qrCodeUrl && (
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '16px',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <img src={qrCodeUrl} alt="QR Code" style={{ width: '150px', height: '150px' }} />
              <p style={{
                marginTop: '8px',
                fontSize: '12px',
                color: '#6b7280',
                fontFamily: 'monospace'
              }}>
                {voucher.serial_no}
              </p>
            </div>
          )}
          
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '16px' }}>
              <span style={{
                display: 'inline-block',
                padding: '8px 16px',
                borderRadius: '16px',
                fontSize: '16px',
                fontWeight: '600',
                backgroundColor: statusStyle.bg,
                color: statusStyle.color
              }}>
                {getStatusLabel(voucher.status)}
              </span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1a202c' }}>
              {voucher.amount.toLocaleString('ko-KR')}원
            </div>
          </div>
        </div>

        {/* 상세 정보 */}
        <div style={{
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          padding: '20px'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1a202c',
            marginBottom: '16px'
          }}>
            기본 정보
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px' }}>
            <InfoRow label="일련번호" value={voucher.serial_no} />
            <InfoRow 
              label="교환권 템플릿" 
              value={voucher.voucher_templates ? 
                `${voucher.voucher_templates.voucher_name} (${voucher.voucher_templates.voucher_type})` : 
                '-'
              } 
            />
            <InfoRow label="이름" value={voucher.name} />
            <InfoRow label="생년월일" value={voucher.dob} />
            <InfoRow label="영농회" value={voucher.association} />
            <InfoRow label="조합원ID" value={voucher.member_id} />
            <InfoRow label="전화번호" value={voucher.phone || '-'} />
            <InfoRow label="발행일시" value={formatDate(voucher.issued_at)} />
            
            {voucher.status === 'used' && (
              <>
                <InfoRow label="사용일시" value={formatDate(voucher.used_at)} />
                <InfoRow label="사용처" value={voucher.usage_location || '-'} />
              </>
            )}
            
            {voucher.notes && (
              <InfoRow label="비고" value={voucher.notes} />
            )}
          </div>
        </div>

        {/* 버튼 그룹 */}
        <div style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
          marginTop: '24px'
        }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '10px 20px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <div style={{
        fontSize: '14px',
        color: '#6b7280',
        fontWeight: '500'
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '14px',
        color: '#1a202c'
      }}>
        {value}
      </div>
    </>
  );
}