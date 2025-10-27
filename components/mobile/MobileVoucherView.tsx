'use client';

import React from 'react';
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
      width: 300,
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
      padding: '24px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        maxWidth: '420px',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '32px 24px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.12)'
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
            color: '#6b7280',
            marginBottom: '4px'
          }}>
            {voucher.association}
          </p>
          <p style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#1f2937'
          }}>
            {voucher.name}
          </p>
        </div>

        {/* Amount */}
        <div style={{
          textAlign: 'center',
          marginBottom: '32px',
          padding: '24px',
          backgroundColor: '#eff6ff',
          borderRadius: '16px'
        }}>
          <div style={{
            fontSize: '48px',
            fontWeight: '800',
            color: '#2563eb'
          }}>
            {voucher.amount.toLocaleString()}원
          </div>
        </div>

        {/* QR Code - Centered and Enlarged */}
        <div style={{
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          {qrCodeUrl && (
            <div style={{
              display: 'inline-block',
              padding: '24px',
              backgroundColor: 'white',
              border: '3px solid #2563eb',
              borderRadius: '16px',
              boxShadow: '0 4px 16px rgba(37, 99, 235, 0.2)'
            }}>
              <img
                src={qrCodeUrl}
                alt="QR Code"
                style={{
                  width: '260px',
                  height: '260px'
                }}
              />
            </div>
          )}
          <p style={{
            marginTop: '16px',
            fontSize: '16px',
            fontFamily: 'monospace',
            fontWeight: '600',
            color: '#1f2937',
            letterSpacing: '0.05em'
          }}>
            {voucher.serial_no}
          </p>
        </div>

        {/* Status */}
        <div style={{
          textAlign: 'center',
          marginBottom: '20px'
        }}>
          {voucher.status === 'issued' ? (
            <div style={{
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#10b981',
              color: 'white',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '700'
            }}>
              ✅ 사용 가능
            </div>
          ) : voucher.status === 'used' ? (
            <div style={{
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#6b7280',
              color: 'white',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '700'
            }}>
              사용 완료
            </div>
          ) : (
            <div style={{
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#fbbf24',
              color: 'white',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '700'
            }}>
              {voucher.status}
            </div>
          )}
        </div>

        {/* Issue Date */}
        <div style={{
          textAlign: 'center',
          fontSize: '14px',
          color: '#9ca3af',
          fontWeight: '500'
        }}>
          발행일: {new Date(voucher.issued_at).toLocaleDateString('ko-KR')}
        </div>

        {/* Used Date if applicable */}
        {voucher.used_at && (
          <div style={{
            textAlign: 'center',
            fontSize: '14px',
            color: '#9ca3af',
            fontWeight: '500',
            marginTop: '8px'
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