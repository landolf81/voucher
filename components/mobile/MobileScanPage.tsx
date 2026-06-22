'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useAuth } from '@/lib/contexts/AuthContext';

// QR 코드 페이로드 파싱 함수
function parseQRPayload(payload: string) {
  if (!payload?.startsWith?.("VCH:")) {
    // 일반 텍스트인 경우 그대로 일련번호로 사용
    return { serial: payload, fullPayload: payload };
  }
  
  // VCH: 형식인 경우 일련번호만 추출
  const parts = Object.fromEntries(payload.split("|").map(kv => kv.split(":") as [string, string]));
  return { 
    serial: parts["VCH"], 
    fullPayload: payload 
  };
}

interface VoucherInfo {
  serial_no: string;
  amount: number;
  association: string;
  name: string;
  status: string;
  scanned_at: string;
  date_comparison?: {
    qr_issued_date: string | null;
    db_issued_date: string;
    qr_issued_date_formatted: string;
    db_issued_date_formatted: string;
    is_match: boolean | null;
    message: string;
  };
}

interface UsageResult {
  serial_no: string;
  success: boolean;
  message: string;
  used_at?: string;
}

export function MobileScanPage() {
  const { user } = useAuth();

  // hooks는 조건문 전에 모두 선언
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scannedVouchers, setScannedVouchers] = useState<VoucherInfo[]>([]);
  const [isLoadingVoucherInfo, setIsLoadingVoucherInfo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<UsageResult[]>([]);
  const [processingMode, setProcessingMode] = useState<'batch'>('batch');
  const [manualInput, setManualInput] = useState('');
  const [showResults, setShowResults] = useState(false);
  
  // 스캔 중복 방지를 위한 ref (동기적 상태 추적)
  const processingQRRef = useRef<Set<string>>(new Set());
  const isProcessingAnyRef = useRef(false);

  // QR 스캔 초기화
  useEffect(() => {
    // 새로운 스캔 시작 시 결과 초기화
    setShowResults(false);
    setResults([]);

    const codeReader = new BrowserMultiFormatReader();
    let isMounted = true;
    let activeStream: MediaStream | null = null;

    const startScanning = async () => {
      try {
        setIsScanning(true);
        setCameraError('');

        // HTTPS 확인
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
          setCameraError('카메라 접근은 HTTPS 환경에서만 가능합니다.');
          return;
        }

        // 먼저 후면 카메라로 권한 요청 시도
        let selectedDeviceId = null;
        try {
          // 후면 카메라 제약조건으로 권한 요청
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: { ideal: 'environment' } // 후면 카메라 우선
            } 
          });
          
          // 스트림에서 실제 사용된 장치 ID 확인
          const tracks = stream.getVideoTracks();
          if (tracks.length > 0) {
            const settings = tracks[0].getSettings();
            selectedDeviceId = settings.deviceId;
            console.log('후면 카메라로 권한 획득:', selectedDeviceId);
          }
          
          // 스트림 정리 (zxing에서 다시 열 것이므로)
          stream.getTracks().forEach(track => track.stop());
          
        } catch (permissionError: any) {
          console.log('후면 카메라 권한 실패, 일반 권한으로 시도:', permissionError);
          
          // 후면 카메라 실패 시 일반 권한 요청
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
          } catch (generalError: any) {
            console.error('카메라 권한 오류:', generalError);
            setCameraError('카메라 접근 권한이 필요합니다. 브라우저 설정에서 카메라 권한을 허용해주세요.');
            return;
          }
        }
        
        // 잠시 대기 후 장치 목록 조회
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        console.log('감지된 카메라 장치들:', devices);
        
        if (!devices || devices.length === 0) {
          setCameraError('카메라 장치를 찾을 수 없습니다. 브라우저 설정을 확인해주세요.');
          return;
        }

        // 장치 ID가 있으면 우선 사용, 없으면 후면 카메라 검색
        let deviceId = selectedDeviceId;
        
        if (!deviceId) {
          // 후면 카메라 우선 선택 (더 넓은 검색)
          const backCamera = devices.find(device => {
            const label = device.label.toLowerCase();
            return label.includes('back') || 
                   label.includes('rear') || 
                   label.includes('환경') ||
                   label.includes('후면') ||
                   label.includes('main') ||
                   !label.includes('front') && !label.includes('user') && !label.includes('전면');
          });
          
          // 후면 카메라가 없으면 마지막 장치 (보통 후면), 그것도 없으면 첫 번째
          deviceId = backCamera?.deviceId || devices[devices.length - 1]?.deviceId || devices[0]?.deviceId;
        }

        if (!deviceId) {
          setCameraError('사용 가능한 카메라 장치가 없습니다.');
          return;
        }

        console.log('사용할 카메라:', deviceId, devices.find(d => d.deviceId === deviceId)?.label);

        // 후면 카메라 제약조건 설정
        const constraints = {
          video: {
            deviceId: { exact: deviceId },
            facingMode: 'environment', // 후면 카메라 강제
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };

        // 스트림 저장을 위해 decodeFromVideoDevice 결과 캡처
        const controls = await codeReader.decodeFromVideoDevice(deviceId, videoRef.current!, (res) => {
          if (!isMounted) return;
          if (res) {
            const scannedPayload = res.getText();
            console.log('QR 스캔 결과:', scannedPayload);
            
            // QR 페이로드에서 일련번호와 전체 페이로드 분리
            const { serial, fullPayload } = parseQRPayload(scannedPayload);
            console.log('추출된 일련번호:', serial);
            
            // 강력한 중복 방지 - 현재 처리 중인 QR인지 확인 (동기적)
            if (processingQRRef.current.has(serial) || isProcessingAnyRef.current) {
              console.log('QR 처리 중복 감지 (동기):', serial, '현재 처리중:', Array.from(processingQRRef.current));
              if ('vibrate' in navigator) {
                navigator.vibrate([100, 50, 100]); // 짧은 진동으로 중복 알림
              }
              return;
            }
            
            // State 기반 중복 확인 (백업)
            const existingVoucher = scannedVouchers.find(v => v.serial_no === serial);
            if (existingVoucher) {
              console.log('중복 스캔 감지 (state):', serial, '기존 상태:', existingVoucher.status);
              if ('vibrate' in navigator) {
                navigator.vibrate([100, 50, 100]);
              }
              return;
            }
            
            // 결과 표시 중이면 무시
            if (showResults) {
              console.log('결과 표시 중 - 스캔 무시');
              return;
            }
            
            // 새로운 교환권 처리 시작
            console.log('새 교환권 스캔 처리 시작:', serial);
            processingQRRef.current.add(serial);
            isProcessingAnyRef.current = true;
            
            handleVoucherScan(serial, fullPayload);
          }
        });

        // 비디오 엘리먼트에서 스트림 저장
        if (videoRef.current?.srcObject) {
          activeStream = videoRef.current.srcObject as MediaStream;
        }
      } catch (e: any) {
        console.error('카메라 오류:', e);
        if (e.name === 'NotAllowedError') {
          setCameraError('카메라 접근이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.');
        } else if (e.name === 'NotFoundError') {
          setCameraError('카메라 장치를 찾을 수 없습니다.');
        } else if (e.name === 'NotSupportedError') {
          setCameraError('이 브라우저는 카메라를 지원하지 않습니다.');
        } else if (e.name === 'NotReadableError') {
          setCameraError('카메라가 다른 앱에서 사용 중입니다.');
        } else {
          setCameraError(`카메라 오류: ${e.message || '알 수 없는 오류'}`);
        }
        setIsScanning(false);
      }
    };

    startScanning();

    return () => {
      isMounted = false;
      // 스트림 정리
      if (activeStream) {
        activeStream.getTracks().forEach(track => {
          track.stop();
        });
      }
      // 비디오 엘리먼트 정리
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      // 잠금 상태 정리
      processingQRRef.current.clear();
      isProcessingAnyRef.current = false;
    };
  }, [scannedVouchers, showResults]);

  // 조회 권한 사용자는 사용 등록 스캔 불가
  if (user?.role === 'inquiry') {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '40px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '20px'
          }}>
            🚫
          </div>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '12px'
          }}>
            접근 권한 없음
          </h2>
          <p style={{
            fontSize: '16px',
            color: '#6b7280',
            lineHeight: '1.5',
            marginBottom: '0'
          }}>
            조회 권한으로는 교환권 사용 등록을<br/>
            할 수 없습니다.
          </p>
          <p style={{
            fontSize: '14px',
            color: '#9ca3af',
            marginTop: '16px'
          }}>
            교환권 조회는 &apos;조회&apos; 메뉴를 이용해주세요.
          </p>
        </div>
      </div>
    );
  }

  // 교환권 정보 조회
  const handleVoucherScan = async (serialNo: string, fullPayload?: string) => {
    console.log('handleVoucherScan 시작:', { serialNo, fullPayload });
    setIsLoadingVoucherInfo(true);
    
    try {
      // API에는 검증을 위해 전체 페이로드 전송, 없으면 일련번호만 전송
      const payload = fullPayload || serialNo;
      console.log('API 호출 전송 데이터:', { payload });
      
      const response = await fetch('/api/v1/vouchers/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payload })
      });

      console.log('API 응답 상태:', response.status);
      const data = await response.json();
      console.log('API 응답 데이터:', data);
      
      if (data.ok && data.voucher) {
        // 교환권 상태에 따른 메시지 및 처리 가능 여부 결정
        let statusMessage = data.voucher.name;
        let isProcessable = false;
        
        switch (data.voucher.status) {
          case 'issued':
            statusMessage = `${data.voucher.name} (발행됨 - 사용 가능)`;
            isProcessable = true;
            break;
          case 'used':
            statusMessage = `${data.voucher.name} (이미 사용됨)`;
            if (data.voucher.usage_location) {
              statusMessage += ` - ${data.voucher.usage_location}`;
            }
            if (data.voucher.used_at) {
              const usedDate = new Date(data.voucher.used_at).toLocaleDateString('ko-KR');
              statusMessage += ` (${usedDate})`;
            }
            break;
          case 'recalled':
            statusMessage = `${data.voucher.name} (회수됨)`;
            break;
          case 'registered':
            statusMessage = `${data.voucher.name} (미발행 - 발행 필요)`;
            break;
          default:
            statusMessage = `${data.voucher.name} (${data.voucher.status})`;
        }

        const voucherInfo: VoucherInfo = {
          serial_no: serialNo,
          amount: data.voucher.amount,
          association: data.voucher.association,
          name: statusMessage,
          status: isProcessable ? data.voucher.status : 'error', // 처리 불가능한 경우 error로 표시
          scanned_at: new Date().toISOString(),
          date_comparison: data.date_comparison
        };
        
        console.log('교환권 정보 추가:', voucherInfo);
        
        // 발행일자 비교 정보가 있고 일치하지 않는 경우 경고 표시
        if (data.date_comparison && data.date_comparison.is_match === false) {
          console.warn('발행일자 불일치 감지:', data.date_comparison.message);
        }
        
        // 사용된 교환권 또는 처리 불가능한 상태의 경우 경고음
        if (!isProcessable && 'vibrate' in navigator) {
          navigator.vibrate([200, 100, 200, 100, 200]);
        }
        
        setScannedVouchers(prev => {
          const newList = [...prev, voucherInfo];
          console.log('업데이트된 스캔 목록:', newList);
          return newList;
        });

        console.log(`교환권 스캔 완료 - 상태: ${data.voucher.status}, 처리가능: ${isProcessable}`);
      } else {
        // 조회 실패한 경우에도 목록에 추가 (오류 표시용)
        let errorMessage = data.error || '교환권 정보를 가져올 수 없습니다';
        
        // 발행일자 불일치 에러인 경우 사용자 친화적 메시지로 변경
        if (data.error === 'ISSUED_DATE_MISMATCH') {
          errorMessage = data.message || '이전에 발행된 교환권입니다. 최신 교환권을 사용해주세요.';
          // 발행일자 비교 정보가 있으면 더 자세한 메시지 추가
          if (data.date_comparison) {
            errorMessage += `\n${data.date_comparison.message}`;
          }
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
          scanned_at: new Date().toISOString(),
          date_comparison: data.date_comparison
        };
        
        console.log('오류 교환권 정보 추가:', voucherInfo);
        setScannedVouchers(prev => {
          const newList = [...prev, voucherInfo];
          console.log('업데이트된 스캔 목록 (오류):', newList);
          return newList;
        });
      }
    } catch (error) {
      console.error('교환권 정보 조회 오류:', error);
      
      const voucherInfo: VoucherInfo = {
        serial_no: serialNo,
        amount: 0,
        association: '조회실패',
        name: `서버 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        status: 'error',
        scanned_at: new Date().toISOString()
      };
      
      console.log('예외 교환권 정보 추가:', voucherInfo);
      setScannedVouchers(prev => {
        const newList = [...prev, voucherInfo];
        console.log('업데이트된 스캔 목록 (예외):', newList);
        return newList;
      });
    } finally {
      console.log('handleVoucherScan 완료, 로딩 상태 해제');
      setIsLoadingVoucherInfo(false);
      
      // 처리 완료 후 잠금 해제
      processingQRRef.current.delete(serialNo);
      if (processingQRRef.current.size === 0) {
        isProcessingAnyRef.current = false;
      }
      console.log('QR 처리 잠금 해제:', serialNo, '남은 처리중:', Array.from(processingQRRef.current));
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
    setShowResults(true);

    try {
      const voucherList = validVouchers.map(voucher => ({
        serial_no: voucher.serial_no,
        usage_location: user?.site_name || '모바일 스캔',
        notes: '모바일 QR 스캔을 통한 일괄 사용 등록'
      }));

      const response = await fetch(`/api/vouchers/bulk-register-use?userId=${user?.id}`, {
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
    const inputSerial = manualInput.trim();
    if (inputSerial) {
      // 중복 방지 확인
      if (processingQRRef.current.has(inputSerial) || isProcessingAnyRef.current) {
        console.log('수동 입력 중복 감지:', inputSerial);
        alert('이미 처리 중인 교환권입니다.');
        return;
      }
      
      const existingVoucher = scannedVouchers.find(v => v.serial_no === inputSerial);
      if (existingVoucher) {
        alert('이미 스캔된 교환권입니다.');
        return;
      }
      
      processingQRRef.current.add(inputSerial);
      isProcessingAnyRef.current = true;
      handleVoucherScan(inputSerial);
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
            일괄 처리
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
            <p style={{ marginBottom: '16px', fontSize: '16px', lineHeight: '1.5' }}>{cameraError}</p>
            
            {/* 카메라 권한 가이드 */}
            {cameraError.includes('권한') && (
              <div style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px',
                textAlign: 'left',
                fontSize: '14px'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>📱 카메라 권한 허용 방법:</div>
                <div>1. 주소창 옆 🔒 또는 ⓘ 아이콘 클릭</div>
                <div>2. &quot;카메라&quot; 또는 &quot;Camera&quot; 허용으로 변경</div>
                <div>3. 페이지 새로고침</div>
              </div>
            )}

            {cameraError.includes('HTTPS') && (
              <div style={{
                backgroundColor: 'rgba(245, 101, 101, 0.1)',
                border: '1px solid rgba(245, 101, 101, 0.3)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px',
                textAlign: 'left',
                fontSize: '14px'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>🔒 보안 연결 필요</div>
                <div>카메라 접근을 위해 HTTPS 연결이 필요합니다.</div>
                <div>안전한 연결로 접속해주세요.</div>
              </div>
            )}
            {/* 재시도 버튼 */}
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '16px',
                marginBottom: '20px',
                cursor: 'pointer'
              }}
            >
              🔄 다시 시도
            </button>

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
            
            {/* 스캔 오버레이 - 상단 위치 */}
            <div style={{
              position: 'absolute',
              top: '20%',
              left: '50%',
              transform: 'translate(-50%, 0)',
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
        {/* 일괄 처리 버튼 */}
        {scannedVouchers.filter(v => v.status !== 'error').length > 0 && (
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

        {/* 스캔된 교환권 목록 */}
        {scannedVouchers.length > 0 && (
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '600',
              margin: '0 0 8px 0'
            }}>
              스캔된 교환권 ({scannedVouchers.length}개)
            </h3>
            {scannedVouchers.slice(-5).reverse().map((voucher, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: voucher.status === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  borderRadius: '6px',
                  padding: '8px',
                  marginBottom: '8px',
                  fontSize: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>
                    {voucher.serial_no.length > 15 ? `${voucher.serial_no.substring(0, 15)}...` : voucher.serial_no}
                  </span>
                  <span style={{ color: voucher.status === 'error' ? '#f87171' : '#10b981', fontWeight: '600' }}>
                    {voucher.status === 'error' ? '❌' : '✅'}
                  </span>
                </div>
                <div style={{ marginTop: '4px', color: '#e5e7eb' }}>
                  {voucher.association} | {voucher.name}
                </div>
                {voucher.amount > 0 && (
                  <div style={{ marginTop: '2px', color: '#fbbf24', fontWeight: '600' }}>
                    {voucher.amount.toLocaleString()}원
                  </div>
                )}
                {/* 발행일자 비교 정보 표시 */}
                {voucher.date_comparison && (
                  <div style={{ 
                    marginTop: '4px', 
                    padding: '4px 6px', 
                    borderRadius: '4px',
                    backgroundColor: voucher.date_comparison.is_match === false ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                    fontSize: '11px',
                    color: voucher.date_comparison.is_match === false ? '#fca5a5' : '#a7f3d0'
                  }}>
                    📅 {voucher.date_comparison.message}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 처리 결과 모달 */}
      {showResults && results.length > 0 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#1f2937',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              marginBottom: '16px',
              color: '#ffffff',
              textAlign: 'center'
            }}>
              처리 결과
            </h2>
            
            {/* 요약 */}
            <div style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#9ca3af' }}>전체 처리</span>
                <span style={{ color: '#ffffff', fontWeight: '600' }}>{results.length}건</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#9ca3af' }}>성공</span>
                <span style={{ color: '#10b981', fontWeight: '600' }}>
                  {results.filter(r => r.success).length}건
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#9ca3af' }}>실패</span>
                <span style={{ color: '#ef4444', fontWeight: '600' }}>
                  {results.filter(r => !r.success).length}건
                </span>
              </div>
            </div>
            
            {/* 상세 결과 */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#9ca3af',
                marginBottom: '12px'
              }}>
                상세 내역
              </h3>
              {results.map((result, index) => (
                <div
                  key={index}
                  style={{
                    backgroundColor: result.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    borderLeft: `3px solid ${result.success ? '#10b981' : '#ef4444'}`,
                    borderRadius: '6px',
                    padding: '12px',
                    marginBottom: '8px'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <span style={{ 
                      fontFamily: 'monospace', 
                      fontSize: '12px',
                      color: '#ffffff'
                    }}>
                      {result.serial_no}
                    </span>
                    <span style={{ fontSize: '20px' }}>
                      {result.success ? '✅' : '❌'}
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: result.success ? '#86efac' : '#fca5a5'
                  }}>
                    {result.message}
                  </div>
                  {result.used_at && (
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                      사용 시간: {new Date(result.used_at).toLocaleString('ko-KR')}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* 버튼 그룹 */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowResults(false);
                  setResults([]);
                  setScannedVouchers([]);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                새로운 스캔 시작
              </button>
              <button
                onClick={() => setShowResults(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#374151',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}