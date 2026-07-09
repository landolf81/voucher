'use client';

import React, { useState, useEffect, useRef } from 'react';
// 이 파일은 canvas 렌더링에 브라우저 전역 `new Image()` 를 사용하므로 별칭으로 충돌 회피
import NextImage from 'next/image';
import { useParams } from 'next/navigation';
import { MobileVoucherRenderer } from '@/components/voucher/VoucherRenderer';
import { Smartphone, XCircle, RefreshCw, Save, ClipboardList } from 'lucide-react';

interface VoucherData {
  id: string;
  serial_no: string;
  voucher_name: string;
  amount: number;
  member_id: string;
  farming_association: string;
  name: string;
  dob: string;
  phone: string;
  expires_at: string;
  usage_location: string;
  issued_at: string;
  status: string;
  qr_code?: string;
  mobile_image?: string;
  template_html?: string;
  association?: string; // 템플릿 시스템 호환용
  site_id?: string;
}

export default function MobileVoucherPage() {
  const params = useParams();
  const voucherId = params.id as string;
  const [voucher, setVoucher] = useState<VoucherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [useTemplateRenderer, setUseTemplateRenderer] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 교환권 정보 조회
  const fetchVoucher = async () => {
    try {
      const response = await fetch(`/api/vouchers/mobile/${voucherId}`);
      const result = await response.json();
      
      if (result.success) {
        const voucherData = result.data;
        
        // 템플릿 호환성을 위한 데이터 변환
        const processedVoucher = {
          ...voucherData,
          association: voucherData.farming_association, // farming_association을 association으로 매핑
          site_id: voucherData.site_id || 'default'
        };
        
        setVoucher(processedVoucher);
        
        // template_html이 있으면 새로운 템플릿 렌더러 사용
        setUseTemplateRenderer(!!processedVoucher.template_html);
      } else {
        setError(result.message || '교환권을 찾을 수 없습니다.');
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // QR 코드 생성
  const generateQRCode = (data: string): Promise<string> => {
    return new Promise((resolve) => {
      // 간단한 QR 코드 패턴 생성 (실제로는 qrcode 라이브러리 사용 권장)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = 120;
      canvas.height = 120;
      
      // QR 코드 모양 시뮬레이션
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 120, 120);
      ctx.fillStyle = '#ffffff';
      
      // 간단한 패턴
      for (let i = 0; i < 12; i++) {
        for (let j = 0; j < 12; j++) {
          if ((i + j + data.length) % 3 === 0) {
            ctx.fillRect(i * 10, j * 10, 8, 8);
          }
        }
      }
      
      resolve(canvas.toDataURL());
    });
  };

  // 모바일 교환권 이미지 생성
  const generateMobileVoucher = async (): Promise<string> => {
    if (!voucher || !canvasRef.current) return '';

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    
    // 모바일 최적화 크기 (세로형)
    canvas.width = 375;
    canvas.height = 600;
    
    // 배경 그라디언트
    const gradient = ctx.createLinearGradient(0, 0, 0, 600);
    gradient.addColorStop(0, '#4f46e5');
    gradient.addColorStop(1, '#7c3aed');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 375, 600);
    
    // 헤더
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('디지털 교환권', 187.5, 60);
    
    // 교환권명
    ctx.font = 'bold 20px Arial';
    ctx.fillText(voucher.voucher_name, 187.5, 100);
    
    // 카드 영역
    ctx.fillStyle = '#ffffff';
    ctx.roundRect(20, 130, 335, 400, 20);
    ctx.fill();
    
    // 카드 내용
    ctx.fillStyle = '#1f2937';
    ctx.font = '18px Arial';
    ctx.textAlign = 'left';
    
    const startY = 170;
    const lineHeight = 35;
    let currentY = startY;
    
    ctx.fillText(`일련번호: ${voucher.serial_no}`, 40, currentY);
    currentY += lineHeight;
    
    ctx.fillText(`조합원: ${voucher.member_id}`, 40, currentY);
    currentY += lineHeight;
    
    ctx.fillText(`이름: ${voucher.name}`, 40, currentY);
    currentY += lineHeight;
    
    ctx.fillText(`영농회: ${voucher.farming_association}`, 40, currentY);
    currentY += lineHeight;
    
    // 금액 (강조)
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#dc2626';
    ctx.fillText(`${voucher.amount.toLocaleString()}원`, 40, currentY + 10);
    currentY += lineHeight + 15;
    
    // 기타 정보
    ctx.font = '16px Arial';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(`유효기간: ${voucher.expires_at?.split('T')[0]}`, 40, currentY);
    currentY += 25;
    
    ctx.fillText(`사용처: ${voucher.usage_location}`, 40, currentY);
    currentY += 25;
    
    ctx.fillText(`발행일: ${voucher.issued_at?.split('T')[0]}`, 40, currentY);
    
    // QR 코드 생성 및 추가
    const qrCodeData = `${voucher.serial_no}|${voucher.member_id}`;
    const qrCodeUrl = await generateQRCode(qrCodeData);
    
    const qrImage = new Image();
    qrImage.onload = () => {
      ctx.drawImage(qrImage, 225, 350, 100, 100);
    };
    qrImage.src = qrCodeUrl;
    
    // QR 코드 라벨
    ctx.font = '12px Arial';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.fillText('QR 코드로 확인', 275, 470);
    
    // 하단 안내
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('본 교환권은 지정된 사업장에서만 사용 가능합니다.', 187.5, 560);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(canvas.toDataURL('image/png'));
      }, 100);
    });
  };

  // 이미지 다운로드
  const downloadVoucher = async () => {
    if (!voucher) return;
    
    setDownloading(true);
    try {
      const imageUrl = await generateMobileVoucher();
      
      const link = document.createElement('a');
      link.download = `교환권_${voucher.serial_no}.png`;
      link.href = imageUrl;
      link.click();
    } catch (error) {
      console.error('다운로드 오류:', error);
    } finally {
      setDownloading(false);
    }
  };

  // 이미지 저장 (서버에)
  const saveMobileImage = async () => {
    if (!voucher) return;
    
    try {
      const imageUrl = await generateMobileVoucher();
      
      const response = await fetch(`/api/vouchers/mobile/${voucherId}/save-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mobile_image: imageUrl
        })
      });

      const result = await response.json();
      if (result.success) {
        setVoucher({ ...voucher, mobile_image: imageUrl });
      }
    } catch (error) {
      console.error('이미지 저장 오류:', error);
    }
  };

  useEffect(() => {
    fetchVoucher();
  }, [voucherId]);

  useEffect(() => {
    if (voucher && !voucher.mobile_image) {
      // 모바일 이미지가 없으면 자동 생성 및 저장
      saveMobileImage();
    }
  }, [voucher]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}><Smartphone size={32} /></div>
          <div>교환권을 불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8fafc',
        padding: '20px'
      }}>
        <div style={{
          textAlign: 'center',
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '12px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}><XCircle size={48} color="#dc2626" /></div>
          <h2 style={{ fontSize: '20px', marginBottom: '8px', color: '#dc2626' }}>
            오류가 발생했습니다
          </h2>
          <p style={{ color: '#6b7280' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!voucher) return null;

  // 새로운 템플릿 시스템을 사용하는 경우
  if (useTemplateRenderer) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc'
      }}>
        <MobileVoucherRenderer
          voucherData={{
            serial_no: voucher.serial_no,
            amount: voucher.amount,
            association: voucher.association || voucher.farming_association,
            member_id: voucher.member_id,
            name: voucher.name,
            dob: voucher.dob,
            site_id: voucher.site_id || 'default',
            issue_date: voucher.issued_at?.split('T')[0],
            expiry_date: voucher.expires_at?.split('T')[0],
            template_html: voucher.template_html
          }}
          onLoad={() => console.log('모바일 교환권 렌더링 완료')}
          onError={(error) => console.error('모바일 교환권 렌더링 오류:', error)}
        />
      </div>
    );
  }

  // 기존 캔버스 기반 렌더링 (레거시 지원)
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: '20px 0'
    }}>
      {/* 숨겨진 캔버스 */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <div style={{
        maxWidth: '400px',
        margin: '0 auto',
        padding: '0 16px'
      }}>
        {/* 헤더 */}
        <div style={{
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#1a202c',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <Smartphone size={20} /> 모바일 교환권
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#6b7280'
          }}>
            아래 이미지를 저장하여 사용하세요
          </p>
        </div>

        {/* 교환권 이미지 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          border: '1px solid #e5e7eb'
        }}>
          {voucher.mobile_image ? (
            <NextImage
              src={voucher.mobile_image}
              alt="모바일 교환권"
              width={0}
              height={0}
              sizes="100vw"
              unoptimized
              style={{
                width: '100%',
                height: 'auto',
                borderRadius: '8px'
              }}
            />
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6b7280'
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}><RefreshCw size={32} /></div>
              <div>교환권 이미지를 생성하는 중...</div>
            </div>
          )}
        </div>

        {/* 버튼들 */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <button
            onClick={downloadVoucher}
            disabled={downloading}
            style={{
              flex: 1,
              padding: '14px',
              backgroundColor: downloading ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: downloading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            {downloading ? '생성 중...' : (<><Save size={16} /> 이미지 저장</>)}
          </button>
          
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '14px 20px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* 교환권 정보 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            marginBottom: '16px',
            color: '#374151'
          }}>
            교환권 정보
          </h3>
          <div style={{
            display: 'grid',
            gap: '8px',
            fontSize: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>교환권명:</span>
              <span style={{ fontWeight: '500' }}>{voucher.voucher_name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>금액:</span>
              <span style={{ fontWeight: '600', color: '#dc2626' }}>
                {voucher.amount.toLocaleString()}원
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>상태:</span>
              <span style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                backgroundColor: voucher.status === 'issued' ? '#dcfce7' : '#fef2f2',
                color: voucher.status === 'issued' ? '#166534' : '#dc2626'
              }}>
                {voucher.status === 'issued' ? '사용 가능' : '사용 불가'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>유효기간:</span>
              <span>{voucher.expires_at?.split('T')[0]}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>사용처:</span>
              <span>{voucher.usage_location}</span>
            </div>
          </div>
        </div>

        {/* 사용 안내 */}
        <div style={{
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          padding: '16px',
          fontSize: '14px',
          color: '#92400e'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ClipboardList size={16} /> 사용 안내
          </div>
          <ul style={{ margin: 0, paddingLeft: '16px' }}>
            <li>지정된 사용처에서만 사용 가능합니다.</li>
            <li>유효기간을 확인해주세요.</li>
            <li>이미지를 저장하여 오프라인에서도 사용하세요.</li>
            <li>QR 코드로 빠른 확인이 가능합니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}