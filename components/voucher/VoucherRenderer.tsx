'use client';

import React, { useState, useEffect } from 'react';

interface VoucherData {
  serial_no: string;
  amount: number;
  association: string;
  member_id: string;
  name: string;
  dob?: string;
  site_id: string;
  issue_date?: string;
  expiry_date?: string;
  template_html?: string;
}

interface VoucherRendererProps {
  voucherData: VoucherData;
  renderMode: 'mobile' | 'print' | 'preview';
  templateHtml?: string;
  onLoad?: () => void;
  onError?: (error: string) => void;
}

export function VoucherRenderer({
  voucherData,
  renderMode,
  templateHtml,
  onLoad,
  onError
}: VoucherRendererProps) {
  const [processedHtml, setProcessedHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    processTemplate();
  }, [voucherData, templateHtml, renderMode]);

  const processTemplate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/vouchers/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voucherData,
          templateHtml: templateHtml || voucherData.template_html,
          renderMode,
          options: {
            codeFormat: 'dataurl',
            includeResponsiveCSS: true,
            qrCodeSize: renderMode === 'mobile' ? 150 : 100,
            barcodeWidth: renderMode === 'mobile' ? 250 : 200,
            barcodeHeight: renderMode === 'mobile' ? 60 : 50
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      setProcessedHtml(result.html);
      onLoad?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    if (renderMode === 'print') {
      window.print();
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch('/api/vouchers/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voucherData,
          templateHtml: templateHtml || voucherData.template_html
        })
      });

      if (!response.ok) {
        throw new Error('PDF 생성 실패');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `voucher_${voucherData.serial_no}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('PDF 다운로드 실패:', err);
      alert('PDF 다운로드에 실패했습니다.');
    }
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        padding: '40px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '2px dashed #d1d5db'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }}></div>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          교환권 렌더링 중...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '20px',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        color: '#dc2626'
      }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 'bold' }}>
          ❌ 렌더링 오류
        </h3>
        <p style={{ margin: 0, fontSize: '14px' }}>
          {error}
        </p>
        <button
          onClick={processTemplate}
          style={{
            marginTop: '12px',
            padding: '8px 16px',
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      backgroundColor: 'white'
    }}>
      {/* 렌더 모드별 상단 툴바 */}
      {renderMode !== 'preview' && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#f3f4f6',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '14px', color: '#374151' }}>
            {renderMode === 'mobile' ? '📱 모바일 보기' : '🖨️ 인쇄 보기'} - {voucherData.serial_no}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {renderMode === 'print' && (
              <>
                <button
                  onClick={handlePrint}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  🖨️ 인쇄
                </button>
                <button
                  onClick={handleDownloadPDF}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  📄 PDF
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 교환권 콘텐츠 */}
      <div
        style={{
          width: '100%',
          ...(renderMode === 'mobile' && {
            maxWidth: '100vw',
            padding: '10px'
          }),
          ...(renderMode === 'print' && {
            width: '210mm',
            minHeight: '297mm',
            margin: '0 auto',
            padding: '20mm'
          })
        }}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />

      {/* 인라인 스타일 추가 */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @media print {
          .voucher-toolbar {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * 모바일 전용 교환권 렌더러
 */
export function MobileVoucherRenderer(props: Omit<VoucherRendererProps, 'renderMode'>) {
  return <VoucherRenderer {...props} renderMode="mobile" />;
}

/**
 * 인쇄 전용 교환권 렌더러
 */
export function PrintVoucherRenderer(props: Omit<VoucherRendererProps, 'renderMode'>) {
  return <VoucherRenderer {...props} renderMode="print" />;
}

/**
 * 미리보기 전용 교환권 렌더러
 */
export function PreviewVoucherRenderer(props: Omit<VoucherRendererProps, 'renderMode'>) {
  return <VoucherRenderer {...props} renderMode="preview" />;
}