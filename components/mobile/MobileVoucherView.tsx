'use client';

import React from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { useState, useEffect } from 'react';

interface VoucherTemplate {
  voucher_name: string;
  voucher_type: string;
}

interface Voucher {
  id: string;
  serial_no: string;
  amount: number;
  name: string;
  association: string;
  member_id: string;
  dob: string;
  phone: string;
  status: string;
  issued_at: string;
  used_at?: string;
  notes?: string;
  voucher_templates?: VoucherTemplate;
}

interface MobileVoucherViewProps {
  voucher: Voucher;
  template?: VoucherTemplate;
}

export function MobileVoucherView({ voucher, template }: MobileVoucherViewProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    // Generate QR code for the voucher
    QRCode.toDataURL(voucher.serial_no, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    }).then(url => {
      setQrCodeUrl(url);
    });
  }, [voucher.serial_no]);

  const voucherTemplate = template || voucher.voucher_templates;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '400px',
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          <h1 style={{
            fontSize: voucherTemplate?.voucher_name && voucherTemplate.voucher_name.length > 15 ? '20px' : '28px',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '8px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            paddingLeft: '10px',
            paddingRight: '10px'
          }}>
            {voucherTemplate?.voucher_name || '교환권'}
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#6b7280'
          }}>
            {voucher.association}
          </p>
        </div>

        {/* Amount */}
        <div style={{
          textAlign: 'center',
          marginBottom: '24px',
          padding: '20px',
          backgroundColor: '#eff6ff',
          borderRadius: '12px'
        }}>
          <div style={{
            fontSize: '40px',
            fontWeight: '800',
            color: '#2563eb'
          }}>
            {voucher.amount.toLocaleString()}원
          </div>
        </div>

        {/* Personal Info */}
        <div style={{
          backgroundColor: '#f9fafb',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            display: 'grid',
            gap: '12px',
            fontSize: '15px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>성명</span>
              <span style={{ fontWeight: '600', color: '#1f2937' }}>{voucher.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>회원번호</span>
              <span style={{ fontWeight: '600', color: '#1f2937' }}>{voucher.member_id}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>생년월일</span>
              <span style={{ fontWeight: '600', color: '#1f2937' }}>{voucher.dob}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>연락처</span>
              <span style={{ fontWeight: '600', color: '#1f2937' }}>{voucher.phone}</span>
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div style={{
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          {qrCodeUrl && (
            <div style={{
              display: 'inline-block',
              padding: '16px',
              backgroundColor: 'white',
              border: '2px solid #e5e7eb',
              borderRadius: '12px'
            }}>
              <img 
                src={qrCodeUrl} 
                alt="QR Code"
                style={{
                  width: '180px',
                  height: '180px'
                }}
              />
            </div>
          )}
          <p style={{
            marginTop: '12px',
            fontSize: '13px',
            fontFamily: 'monospace',
            color: '#6b7280'
          }}>
            {voucher.serial_no}
          </p>
        </div>

        {/* Status */}
        <div style={{
          textAlign: 'center',
          marginBottom: '16px'
        }}>
          {voucher.status === 'issued' ? (
            <div style={{
              display: 'inline-block',
              padding: '8px 16px',
              backgroundColor: '#10b981',
              color: 'white',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              ✅ 사용 가능
            </div>
          ) : voucher.status === 'used' ? (
            <div style={{
              display: 'inline-block',
              padding: '8px 16px',
              backgroundColor: '#6b7280',
              color: 'white',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              사용 완료
            </div>
          ) : (
            <div style={{
              display: 'inline-block',
              padding: '8px 16px',
              backgroundColor: '#fbbf24',
              color: 'white',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {voucher.status}
            </div>
          )}
        </div>

        {/* Issue Date */}
        <div style={{
          textAlign: 'center',
          fontSize: '13px',
          color: '#9ca3af'
        }}>
          발행일: {new Date(voucher.issued_at).toLocaleDateString('ko-KR')}
        </div>

        {/* Used Date if applicable */}
        {voucher.used_at && (
          <div style={{
            textAlign: 'center',
            fontSize: '13px',
            color: '#9ca3af',
            marginTop: '4px'
          }}>
            사용일: {new Date(voucher.used_at).toLocaleDateString('ko-KR')}
          </div>
        )}

        {/* Notes */}
        {voucher.notes && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#92400e'
          }}>
            📝 {voucher.notes}
          </div>
        )}
      </div>
    </div>
  );
}