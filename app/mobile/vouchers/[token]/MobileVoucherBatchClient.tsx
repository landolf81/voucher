'use client';

/**
 * Mobile Voucher Batch Client Component
 * Handles interactive features for mobile voucher batch display and downloads
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';

interface BatchData {
  id: string;
  batch_name: string;
  total_count: number;
  generated_count: number;
  status: string;
  expires_at: string;
  user_id: string;
  template_id: string;
  download_count: number;
  last_accessed_at: string | null;
  voucher_templates: {
    voucher_name: string;
    voucher_type: string;
  };
  user_profiles: {
    name: string;
  };
}

interface VoucherData {
  id: string;
  serial_no: string;
  amount: number;
  association: string;
  name: string;
  member_id: string | null;
  dob: string;
  phone: string | null;
  status: string;
  issued_at: string;
  notes: string | null;
}

interface Props {
  batch: BatchData;
  vouchers: VoucherData[];
  token: string;
}

export default function MobileVoucherBatchClient({ batch, vouchers, token }: Props) {
  const [selectedVouchers, setSelectedVouchers] = useState<Set<string>>(new Set());
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [showUsedModal, setShowUsedModal] = useState(false);
  const [usedVoucherInfo, setUsedVoucherInfo] = useState<{serial_no: string; used_at: string; location: string} | null>(null);
  
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const sessionId = useRef<string | null>(null);
  const lastETag = useRef<string | null>(null);
  const isPageVisible = useRef(true);
  
  const expiresAt = new Date(batch.expires_at);
  const timeRemaining = Math.max(0, expiresAt.getTime() - Date.now());
  const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  // Select all vouchers
  const handleSelectAll = () => {
    if (selectedVouchers.size === vouchers.length) {
      setSelectedVouchers(new Set());
    } else {
      setSelectedVouchers(new Set(vouchers.map(v => v.id)));
    }
  };

  // Toggle individual voucher selection
  const handleToggleVoucher = (voucherId: string) => {
    const newSelected = new Set(selectedVouchers);
    if (newSelected.has(voucherId)) {
      newSelected.delete(voucherId);
    } else {
      newSelected.add(voucherId);
    }
    setSelectedVouchers(newSelected);
  };

  // Check voucher status with polling
  const checkVoucherStatus = useCallback(async () => {
    if (!isPageVisible.current) return;
    
    try {
      const headers: HeadersInit = {
        'Accept': 'application/json',
      };
      
      if (sessionId.current) {
        headers['X-Session-ID'] = sessionId.current;
      }
      
      if (lastETag.current) {
        headers['If-None-Match'] = lastETag.current;
      }
      
      const response = await fetch(`/api/vouchers/mobile-status/${token}`, {
        method: 'GET',
        headers,
        credentials: 'same-origin',
      });
      
      // Handle rate limiting
      if (response.status === 429) {
        console.warn('Rate limit exceeded, slowing down polling');
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = setInterval(checkVoucherStatus, 10000); // Slow down to 10 seconds
        }
        return;
      }
      
      // Handle not modified (304)
      if (response.status === 304) {
        return; // No change
      }
      
      // Get session ID from response
      const newSessionId = response.headers.get('X-Session-ID');
      if (newSessionId) {
        sessionId.current = newSessionId;
      }
      
      // Get ETag for next request
      const etag = response.headers.get('ETag');
      if (etag) {
        lastETag.current = etag;
      }
      
      if (response.ok) {
        const data = await response.json();
        
        // Check if status changed to 'used'
        if (data.status === 'used' && data.status_changed) {
          setUsedVoucherInfo({
            serial_no: vouchers[0]?.serial_no || '',
            used_at: data.used_at || new Date().toISOString(),
            location: data.usage_location || '사용처 미상'
          });
          setShowUsedModal(true);
          
          // Stop polling after voucher is used
          if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
            pollingInterval.current = null;
          }
        }
      }
    } catch (error) {
      console.error('Status check failed:', error);
    }
  }, [token, vouchers]);

  // Setup polling and visibility change listener
  useEffect(() => {
    // Handle page visibility change
    const handleVisibilityChange = () => {
      isPageVisible.current = !document.hidden;
      
      if (isPageVisible.current && !pollingInterval.current) {
        // Resume polling when page becomes visible
        pollingInterval.current = setInterval(checkVoucherStatus, 5000);
      } else if (!isPageVisible.current && pollingInterval.current) {
        // Stop polling when page becomes hidden
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    };
    
    // Start initial polling
    pollingInterval.current = setInterval(checkVoucherStatus, 5000);
    checkVoucherStatus(); // Initial check
    
    // Add event listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkVoucherStatus]);

  // Download individual voucher image
  const handleDownloadSingle = async (voucher: VoucherData) => {
    try {
      setIsGeneratingImages(true);
      
      const response = await fetch('/api/vouchers/mobile-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voucher_id: voucher.id,
          template_id: batch.template_id
        }),
      });

      if (!response.ok) {
        throw new Error('이미지 생성 실패');
      }

      // Download the generated image
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `voucher_${voucher.serial_no}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Download error:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingImages(false);
    }
  };

  // Download selected vouchers as ZIP
  const handleDownloadSelected = async () => {
    if (selectedVouchers.size === 0) {
      alert('다운로드할 교환권을 선택해주세요.');
      return;
    }

    try {
      setIsGeneratingImages(true);
      setDownloadProgress(0);

      const voucherIds = Array.from(selectedVouchers);
      
      const response = await fetch('/api/vouchers/mobile-batch-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voucher_ids: voucherIds,
          template_id: batch.template_id,
          batch_name: batch.batch_name
        }),
      });

      if (!response.ok) {
        throw new Error('일괄 다운로드 실패');
      }

      // Download the ZIP file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vouchers_${batch.batch_name}_${voucherIds.length}개.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Batch download error:', error);
      alert('일괄 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingImages(false);
      setDownloadProgress(0);
    }
  };

  // Share functionality
  const handleShare = async () => {
    const shareData = {
      title: `교환권 ${batch.batch_name}`,
      text: `${batch.total_count}개의 교환권이 발행되었습니다.`,
      url: window.location.href,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.log('Share canceled');
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('링크가 클립보드에 복사되었습니다.');
      } catch (error) {
        setShareModalOpen(true);
      }
    }
  };

  // Copy link to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('링크가 클립보드에 복사되었습니다.');
      setShareModalOpen(false);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = window.location.href;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('링크가 클립보드에 복사되었습니다.');
      setShareModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              🎫 {batch.batch_name}
            </h1>
            <p className="text-sm text-gray-600">
              {batch.voucher_templates.voucher_name}
            </p>
          </div>
          
          {/* Batch Info */}
          <div className="mt-4 bg-gray-50 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">발행자:</span>
                <span className="ml-2 font-medium">{batch.user_profiles.name}</span>
              </div>
              <div>
                <span className="text-gray-500">수량:</span>
                <span className="ml-2 font-medium">{batch.total_count}개</span>
              </div>
              <div>
                <span className="text-gray-500">상태:</span>
                <span className="ml-2 font-medium text-green-600">
                  {batch.status === 'completed' ? '발행완료' : batch.status}
                </span>
              </div>
              <div>
                <span className="text-gray-500">만료:</span>
                <span className="ml-2 font-medium text-orange-600">
                  {daysRemaining > 0 ? `${daysRemaining}일` : `${hoursRemaining}시간`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 font-medium"
              >
                {selectedVouchers.size === vouchers.length ? '전체 해제' : '전체 선택'}
              </button>
              {selectedVouchers.size > 0 && (
                <span className="text-sm text-gray-500">
                  {selectedVouchers.size}개 선택됨
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={handleShare}
                className="p-2 text-gray-600 hover:text-blue-600"
                title="공유하기"
              >
                📤
              </button>
              {selectedVouchers.size > 0 && (
                <button
                  onClick={handleDownloadSelected}
                  disabled={isGeneratingImages}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50"
                >
                  {isGeneratingImages ? '생성 중...' : '일괄 다운로드'}
                </button>
              )}
            </div>
          </div>
          
          {/* Download Progress */}
          {isGeneratingImages && downloadProgress > 0 && (
            <div className="mt-2">
              <div className="bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">
                {downloadProgress}% 완료
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Voucher List */}
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="space-y-4">
          {vouchers.map((voucher) => (
            <div
              key={voucher.id}
              style={{
                backgroundColor: 'white',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                position: 'relative'
              }}
            >
              {/* Checkbox */}
              <div style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                zIndex: 10
              }}>
                <input
                  type="checkbox"
                  checked={selectedVouchers.has(voucher.id)}
                  onChange={() => handleToggleVoucher(voucher.id)}
                  style={{
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer'
                  }}
                />
              </div>

              {/* Header - Association & Name */}
              <div style={{
                textAlign: 'center',
                marginBottom: '20px',
                paddingTop: '12px'
              }}>
                <p style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  marginBottom: '4px'
                }}>
                  {voucher.association}
                </p>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#1f2937'
                }}>
                  {voucher.name}
                </h3>
              </div>

              {/* Amount */}
              <div style={{
                textAlign: 'center',
                marginBottom: '20px',
                padding: '16px',
                backgroundColor: '#eff6ff',
                borderRadius: '12px'
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: '800',
                  color: '#2563eb'
                }}>
                  {voucher.amount.toLocaleString()}원
                </div>
              </div>

              {/* Serial Number */}
              <div style={{
                textAlign: 'center',
                marginBottom: '16px'
              }}>
                <p style={{
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  fontWeight: '600',
                  color: '#6b7280',
                  letterSpacing: '0.05em'
                }}>
                  {voucher.serial_no}
                </p>
              </div>

              {/* Status Badge */}
              <div style={{
                textAlign: 'center',
                marginBottom: '12px'
              }}>
                {voucher.status === 'issued' ? (
                  <span style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    ✅ 사용 가능
                  </span>
                ) : voucher.status === 'used' ? (
                  <span style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    사용 완료
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    backgroundColor: '#fbbf24',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    {voucher.status}
                  </span>
                )}
              </div>

              {/* Issue Date */}
              <div style={{
                textAlign: 'center',
                fontSize: '12px',
                color: '#9ca3af',
                marginBottom: '16px'
              }}>
                발행일: {new Date(voucher.issued_at).toLocaleDateString('ko-KR')}
              </div>

              {/* Download Button */}
              <button
                onClick={() => handleDownloadSingle(voucher)}
                disabled={isGeneratingImages}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: isGeneratingImages ? '#d1d5db' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isGeneratingImages ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {isGeneratingImages ? '생성 중...' : '📥 다운로드'}
              </button>
            </div>
          ))}
        </div>
        
        {vouchers.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-2">📋</div>
            <p className="text-gray-500">교환권이 없습니다.</p>
          </div>
        )}
      </div>

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full p-6">
            <h3 className="text-lg font-medium mb-4">링크 공유</h3>
            <div className="bg-gray-50 p-3 rounded mb-4">
              <p className="text-sm text-gray-600 break-all">
                {window.location.href}
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-2 bg-blue-600 text-white rounded font-medium"
              >
                복사하기
              </button>
              <button
                onClick={() => setShareModalOpen(false)}
                className="flex-1 py-2 bg-gray-200 text-gray-800 rounded font-medium"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Used Modal */}
      {showUsedModal && usedVoucherInfo && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4"
          onClick={() => setShowUsedModal(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              animation: 'bounceIn 0.3s ease-out'
            }}
          >
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                교환권이 사용되었습니다
              </h2>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
                <div className="mb-2">
                  <span className="text-sm text-gray-600">일련번호:</span>
                  <p className="font-semibold text-gray-900">{usedVoucherInfo.serial_no}</p>
                </div>
                <div className="mb-2">
                  <span className="text-sm text-gray-600">사용 시간:</span>
                  <p className="font-semibold text-gray-900">
                    {new Date(usedVoucherInfo.used_at).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">사용처:</span>
                  <p className="font-semibold text-gray-900">{usedVoucherInfo.location}</p>
                </div>
              </div>
              
              <button
                onClick={() => setShowUsedModal(false)}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="max-w-md mx-auto px-4 py-6 text-center text-sm text-gray-500">
        <p>교환권 관리 시스템</p>
        <p className="mt-1">
          만료일: {expiresAt.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
      
      <style jsx>{`
        @keyframes bounceIn {
          0% { transform: scale(0.9); opacity: 0; }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}