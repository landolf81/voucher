'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useAuth } from '@/lib/contexts/AuthContext';

interface VoucherInfo {
  serial_no: string;
  amount: number;
  association: string;
  name: string;
  status: string;
  scanned_at: string;
}

interface UsageResult {
  serial_no: string;
  success: boolean;
  message: string;
  used_at?: string;
}

export function MobileScanPage() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scannedVouchers, setScannedVouchers] = useState<VoucherInfo[]>([]);
  const [isLoadingVoucherInfo, setIsLoadingVoucherInfo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<UsageResult[]>([]);
  const [processingMode, setProcessingMode] = useState<'instant' | 'batch'>('instant');
  const [manualInput, setManualInput] = useState('');

  // QR 스캔 초기화
  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    let isMounted = true;

    const startScanning = async () => {
      try {
        setIsScanning(true);
        setCameraError('');
        
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!devices || devices.length === 0) {
          setCameraError('카메라를 찾을 수 없습니다.');
          return;
        }

        // 후면 카메라 우선 선택
        const backCamera = devices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear')
        );
        const deviceId = backCamera?.deviceId || devices[0]?.deviceId;

        if (!deviceId) {
          setCameraError('카메라 장치 ID를 찾을 수 없습니다.');
          return;
        }

        await codeReader.decodeFromVideoDevice(deviceId, videoRef.current!, (res) => {
          if (!isMounted) return;
          if (res) {
            const scannedSerial = res.getText();
            // 중복 스캔 방지
            if (!scannedVouchers.find(v => v.serial_no === scannedSerial)) {
              handleVoucherScan(scannedSerial);
            }
          }
        });
      } catch (e: any) {
        console.error('카메라 오류:', e);
        setCameraError(`카메라 오류: ${e.message || '알 수 없는 오류'}`);
        setIsScanning(false);
      }
    };

    startScanning();

    return () => { 
      isMounted = false; 
      try {
        codeReader.reset();
      } catch (e) {
        console.log('카메라 정리 중 오류:', e);
      }
    };
  }, [scannedVouchers]);

  // 교환권 정보 조회
  const handleVoucherScan = async (serialNo: string) => {
    setIsLoadingVoucherInfo(true);
    
    try {
      const response = await fetch('/api/v1/vouchers/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payload: serialNo })
      });

      const data = await response.json();
      
      if (data.ok && data.voucher) {
        const voucherInfo: VoucherInfo = {
          serial_no: serialNo,
          amount: data.voucher.amount,
          association: data.voucher.association,
          name: data.voucher.name,
          status: data.voucher.status,
          scanned_at: new Date().toISOString()
        };
        
        setScannedVouchers(prev => [...prev, voucherInfo]);

        // 즉시 처리 모드인 경우 바로 사용 등록
        if (processingMode === 'instant' && data.voucher.status === 'issued') {
          await processVoucherUsage(voucherInfo);
        }
      } else {
        // 조회 실패한 경우에도 목록에 추가 (오류 표시용)
        let errorMessage = data.error || '교환권 정보를 가져올 수 없습니다';
        
        // 발행일자 불일치 에러인 경우 사용자 친화적 메시지로 변경
        if (data.error === 'ISSUED_DATE_MISMATCH') {
          errorMessage = data.message || '이전에 발행된 교환권입니다. 최신 교환권을 사용해주세요.';
        } else if (data.error === 'INVALID_SIGNATURE') {
          errorMessage = '유효하지 않은 QR코드입니다.';
        } else if (data.error === 'NOT_FOUND') {
          errorMessage = '등록되지 않은 교환권입니다.';
        }
        
        const voucherInfo: VoucherInfo = {
          serial_no: serialNo,
          amount: 0,
          association: '조회실패',
          name: errorMessage,
          status: 'error',
          scanned_at: new Date().toISOString()
        };
        
        setScannedVouchers(prev => [...prev, voucherInfo]);
      }
    } catch (error) {
      console.error('교환권 정보 조회 오류:', error);
      
      const voucherInfo: VoucherInfo = {
        serial_no: serialNo,
        amount: 0,
        association: '조회실패',
        name: '서버 오류가 발생했습니다',
        status: 'error',
        scanned_at: new Date().toISOString()
      };
      
      setScannedVouchers(prev => [...prev, voucherInfo]);
    } finally {
      setIsLoadingVoucherInfo(false);
    }
  };

  // 개별 교환권 사용 처리
  const processVoucherUsage = async (voucher: VoucherInfo) => {
    try {
      const response = await fetch('/api/vouchers/register-use', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          serial_no: voucher.serial_no,
          usage_location: user?.site_name || '모바일 스캔',
          site_id: user?.site_id,
          notes: '모바일 QR 스캔을 통한 사용 등록'
        })
      });

      const data = await response.json();
      
      const result: UsageResult = {
        serial_no: voucher.serial_no,
        success: data.success,
        message: data.message,
        used_at: data.data?.used_at
      };

      setResults(prev => [result, ...prev]);

      // 성공 시 진동 피드백 (모바일)
      if (data.success && 'vibrate' in navigator) {
        navigator.vibrate(200);
      }
    } catch (error) {
      console.error('교환권 사용 등록 오류:', error);
      setResults(prev => [{
        serial_no: voucher.serial_no,
        success: false,
        message: '서버 오류가 발생했습니다.'
      }, ...prev]);
    }
  };

  // 일괄 처리
  const handleBatchProcess = async () => {
    const validVouchers = scannedVouchers.filter(v => v.status !== 'error');
    
    if (validVouchers.length === 0) {
      alert('처리할 유효한 교환권이 없습니다.');
      return;
    }

    setIsProcessing(true);
    setResults([]);

    try {
      const voucherList = validVouchers.map(voucher => ({
        serial_no: voucher.serial_no,
        usage_location: user?.site_name || '모바일 스캔',
        notes: '모바일 QR 스캔을 통한 일괄 사용 등록'
      }));

      const response = await fetch('/api/vouchers/bulk-register-use', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vouchers: voucherList,
          site_id: user?.site_id,
          bulk_notes: '모바일 일괄 처리'
        })
      });

      const data = await response.json();
      
      if (data.results) {
        setResults(data.results);
        if (data.success) {
          setScannedVouchers([]);
          // 성공 시 진동 피드백
          if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
          }
        }
      }
    } catch (error) {
      console.error('일괄 처리 오류:', error);
      setResults([{
        serial_no: 'bulk_operation',
        success: false,
        message: '서버 오류가 발생했습니다.'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // 수동 입력 처리
  const handleManualInput = () => {
    if (manualInput.trim()) {
      handleVoucherScan(manualInput.trim());
      setManualInput('');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#000',
      position: 'relative',
      color: 'white'
    }}>
      {/* 상단 헤더 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
        padding: '20px 20px 40px',
        paddingTop: 'max(20px, env(safe-area-inset-top))'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h1 style={{
            fontSize: '20px',
            fontWeight: '600',
            margin: 0
          }}>
            QR 코드 스캔
          </h1>
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '20px',
            padding: '6px 12px',
            fontSize: '14px'
          }}>
            {processingMode === 'instant' ? '즉시 처리' : '일괄 처리'}
          </div>
        </div>
      </div>

      {/* 카메라 영역 */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100vh'
      }}>
        {cameraError ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📷</div>
            <p style={{ marginBottom: '20px' }}>{cameraError}</p>
            {/* 수동 입력 폴백 */}
            <div style={{
              width: '100%',
              maxWidth: '300px'
            }}>
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleManualInput();
                  }
                }}
                placeholder="일련번호를 입력하세요"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #374151',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  fontSize: '16px',
                  marginBottom: '12px'
                }}
              />
              <button
                onClick={handleManualInput}
                disabled={!manualInput.trim()}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: manualInput.trim() ? '#3b82f6' : '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600'
                }}
              >
                추가
              </button>
            </div>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }} 
            />
            
            {/* 스캔 오버레이 */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '250px',
              height: '250px',
              border: '2px solid #10b981',
              borderRadius: '20px',
              background: 'transparent'
            }}>
              {/* 코너 가이드 */}
              {[
                { top: '-2px', left: '-2px', borderTop: '4px solid #10b981', borderLeft: '4px solid #10b981' },
                { top: '-2px', right: '-2px', borderTop: '4px solid #10b981', borderRight: '4px solid #10b981' },
                { bottom: '-2px', left: '-2px', borderBottom: '4px solid #10b981', borderLeft: '4px solid #10b981' },
                { bottom: '-2px', right: '-2px', borderBottom: '4px solid #10b981', borderRight: '4px solid #10b981' }
              ].map((style, index) => (
                <div
                  key={index}
                  style={{
                    position: 'absolute',
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    ...style
                  }}
                />
              ))}
            </div>

            {/* 스캔 상태 표시 */}
            <div style={{
              position: 'absolute',
              bottom: '150px',
              left: '20px',
              right: '20px',
              textAlign: 'center'
            }}>
              {isLoadingVoucherInfo && (
                <div style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.9)',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '12px'
                }}>
                  교환권 정보 조회 중...
                </div>
              )}
              
              <p style={{
                backgroundColor: 'rgba(0,0,0,0.7)',
                borderRadius: '8px',
                padding: '12px',
                margin: 0,
                fontSize: '16px'
              }}>
                QR 코드를 프레임 안에 맞춰주세요
              </p>
            </div>
          </>
        )}
      </div>

      {/* 하단 컨트롤 */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
        padding: '40px 20px 100px', // 네비게이션 공간 확보
        paddingBottom: 'max(100px, calc(100px + env(safe-area-inset-bottom)))'
      }}>
        {/* 처리 모드 전환 */}
        <div style={{
          display: 'flex',
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '4px',
          marginBottom: '16px'
        }}>
          <button
            onClick={() => setProcessingMode('instant')}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: processingMode === 'instant' ? '#10b981' : 'transparent',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            즉시 처리
          </button>
          <button
            onClick={() => setProcessingMode('batch')}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: processingMode === 'batch' ? '#10b981' : 'transparent',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            일괄 처리 ({scannedVouchers.filter(v => v.status !== 'error').length})
          </button>
        </div>

        {/* 일괄 처리 버튼 */}
        {processingMode === 'batch' && scannedVouchers.filter(v => v.status !== 'error').length > 0 && (
          <button
            onClick={handleBatchProcess}
            disabled={isProcessing}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: isProcessing ? '#6b7280' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '16px'
            }}
          >
            {isProcessing ? '처리 중...' : `${scannedVouchers.filter(v => v.status !== 'error').length}개 교환권 일괄 처리`}
          </button>
        )}

        {/* 최근 결과 */}
        {results.length > 0 && (
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '12px',
            maxHeight: '120px',
            overflowY: 'auto'
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '600',
              margin: '0 0 8px 0'
            }}>
              최근 처리 결과
            </h3>
            {results.slice(0, 3).map((result, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                  fontSize: '12px'
                }}
              >
                <span style={{ fontFamily: 'monospace' }}>
                  {result.serial_no.length > 20 ? `${result.serial_no.substring(0, 20)}...` : result.serial_no}
                </span>
                <span style={{ color: result.success ? '#10b981' : '#f87171' }}>
                  {result.success ? '✅' : '❌'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}