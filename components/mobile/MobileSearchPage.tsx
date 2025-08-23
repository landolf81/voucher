'use client';

import React, { useState, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface VoucherData {
  id: string;
  serial_no: string;
  amount: number;
  association: string;
  name: string;
  status: string;
  issued_at: string;
  used_at?: string;
  usage_location?: string;
  voucher_templates?: {
    voucher_name: string;
    voucher_type: string;
  };
}

export function MobileSearchPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [searchMethod, setSearchMethod] = useState<'manual' | 'scan'>('manual');
  const [searchInput, setSearchInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<VoucherData[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherData | null>(null);
  const [cameraError, setCameraError] = useState('');

  // QR 스캔 시작
  const startQRScan = async () => {
    const codeReader = new BrowserMultiFormatReader();
    
    try {
      setIsScanning(true);
      setCameraError('');

      // 먼저 후면 카메라로 권한 요청 시도
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { ideal: 'environment' } // 후면 카메라 우선
          } 
        });
        stream.getTracks().forEach(track => track.stop());
      } catch (permissionError: any) {
        console.log('후면 카메라 권한 실패, 일반 권한으로 시도');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
      }
      
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      if (!devices || devices.length === 0) {
        setCameraError('카메라를 찾을 수 없습니다.');
        return;
      }

      // 후면 카메라 우선 선택 (개선된 검색)
      const backCamera = devices.find(device => {
        const label = device.label.toLowerCase();
        return label.includes('back') || 
               label.includes('rear') || 
               label.includes('환경') ||
               label.includes('후면') ||
               label.includes('main') ||
               !label.includes('front') && !label.includes('user') && !label.includes('전면');
      });
      const deviceId = backCamera?.deviceId || devices[devices.length - 1]?.deviceId || devices[0]?.deviceId;

      if (!deviceId) {
        setCameraError('카메라 장치 ID를 찾을 수 없습니다.');
        return;
      }

      console.log('조회용 QR스캔 - 사용할 카메라:', deviceId, devices.find(d => d.deviceId === deviceId)?.label);

      await codeReader.decodeFromVideoDevice(deviceId, videoRef.current!, (res) => {
        if (res) {
          const scannedSerial = res.getText();
          setSearchInput(scannedSerial);
          setIsScanning(false);
          codeReader.reset();
          performSearch(scannedSerial);
        }
      });
    } catch (e: any) {
      console.error('카메라 오류:', e);
      setCameraError(`카메라 오류: ${e.message || '알 수 없는 오류'}`);
      setIsScanning(false);
    }
  };

  // QR 스캔 중지
  const stopQRScan = () => {
    setIsScanning(false);
    setCameraError('');
  };

  // 교환권 검색
  const performSearch = async (searchTerm?: string) => {
    const term = searchTerm || searchInput;
    if (!term.trim()) {
      alert('검색할 일련번호를 입력해주세요.');
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    setSelectedVoucher(null);

    try {
      // 먼저 단일 교환권 검증 API 시도
      const verifyResponse = await fetch('/api/v1/vouchers/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payload: term.trim() })
      });

      const verifyData = await verifyResponse.json();
      
      if (verifyData.ok && verifyData.voucher) {
        // 단일 결과 표시
        const voucher: VoucherData = {
          id: verifyData.voucher.id || '1',
          serial_no: term.trim(),
          amount: verifyData.voucher.amount,
          association: verifyData.voucher.association,
          name: verifyData.voucher.name,
          status: verifyData.voucher.status,
          issued_at: verifyData.voucher.issued_at || new Date().toISOString(),
          used_at: verifyData.voucher.used_at,
          usage_location: verifyData.voucher.usage_location,
          voucher_templates: verifyData.voucher.voucher_templates
        };
        
        setSearchResults([voucher]);
        setSelectedVoucher(voucher);
      } else {
        // 검색 API로 폴백 (부분 일치 등)
        // TODO: 실제 검색 API 구현 시 사용
        setSearchResults([]);
        alert(verifyData.error || '해당 일련번호의 교환권을 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('검색 오류:', error);
      alert('검색 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  // 상태별 색상 반환
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'issued': return '#10b981'; // 초록
      case 'used': return '#6b7280'; // 회색
      case 'recalled': return '#f59e0b'; // 주황
      case 'disposed': return '#ef4444'; // 빨강
      default: return '#6b7280';
    }
  };

  // 상태별 텍스트 반환
  const getStatusText = (status: string) => {
    switch (status) {
      case 'issued': return '발행됨';
      case 'used': return '사용됨';
      case 'recalled': return '회수됨';
      case 'disposed': return '폐기됨';
      default: return status;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      paddingBottom: '100px' // 네비게이션 공간
    }}>
      {/* 헤더 */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        paddingTop: 'max(20px, env(safe-area-inset-top))',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#1f2937',
          margin: '0 0 16px 0'
        }}>
          교환권 조회
        </h1>

        {/* 검색 방법 선택 */}
        <div style={{
          display: 'flex',
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          padding: '4px',
          marginBottom: '16px'
        }}>
          <button
            onClick={() => {
              setSearchMethod('manual');
              if (isScanning) stopQRScan();
            }}
            style={{
              flex: 1,
              padding: '8px 16px',
              backgroundColor: searchMethod === 'manual' ? 'white' : 'transparent',
              color: searchMethod === 'manual' ? '#1f2937' : '#6b7280',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: searchMethod === 'manual' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            수동 입력
          </button>
          <button
            onClick={() => {
              setSearchMethod('scan');
              startQRScan();
            }}
            style={{
              flex: 1,
              padding: '8px 16px',
              backgroundColor: searchMethod === 'scan' ? 'white' : 'transparent',
              color: searchMethod === 'scan' ? '#1f2937' : '#6b7280',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: searchMethod === 'scan' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            QR 스캔
          </button>
        </div>

        {/* 검색 입력 */}
        {searchMethod === 'manual' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  performSearch();
                }
              }}
              placeholder="교환권 일련번호를 입력하세요"
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '16px',
                fontFamily: 'monospace'
              }}
            />
            <button
              onClick={() => performSearch()}
              disabled={isSearching || !searchInput.trim()}
              style={{
                padding: '12px 16px',
                backgroundColor: (isSearching || !searchInput.trim()) ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                minWidth: '80px'
              }}
            >
              {isSearching ? '검색 중' : '검색'}
            </button>
          </div>
        )}
      </div>

      {/* QR 스캔 모드 */}
      {searchMethod === 'scan' && (
        <div style={{
          backgroundColor: '#000',
          position: 'relative',
          height: '300px'
        }}>
          {cameraError ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              color: 'white',
              textAlign: 'center',
              padding: '20px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📷</div>
              <p>{cameraError}</p>
              <button
                onClick={() => setSearchMethod('manual')}
                style={{
                  marginTop: '16px',
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px'
                }}
              >
                수동 입력으로 전환
              </button>
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
                width: '200px',
                height: '200px',
                border: '2px solid #3b82f6',
                borderRadius: '16px',
                background: 'transparent'
              }}>
                {/* 코너 가이드 */}
                {[
                  { top: '-2px', left: '-2px', borderTop: '4px solid #3b82f6', borderLeft: '4px solid #3b82f6' },
                  { top: '-2px', right: '-2px', borderTop: '4px solid #3b82f6', borderRight: '4px solid #3b82f6' },
                  { bottom: '-2px', left: '-2px', borderBottom: '4px solid #3b82f6', borderLeft: '4px solid #3b82f6' },
                  { bottom: '-2px', right: '-2px', borderBottom: '4px solid #3b82f6', borderRight: '4px solid #3b82f6' }
                ].map((style, index) => (
                  <div
                    key={index}
                    style={{
                      position: 'absolute',
                      width: '16px',
                      height: '16px',
                      borderRadius: '2px',
                      ...style
                    }}
                  />
                ))}
              </div>

              {/* 스캔 안내 */}
              <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                right: '20px',
                textAlign: 'center',
                color: 'white'
              }}>
                <p style={{
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  borderRadius: '8px',
                  padding: '12px',
                  margin: 0,
                  fontSize: '14px'
                }}>
                  QR 코드를 프레임 안에 맞춰주세요
                </p>
                <button
                  onClick={stopQRScan}
                  style={{
                    marginTop: '12px',
                    padding: '8px 16px',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  스캔 중지
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 검색 결과 */}
      <div style={{ padding: '20px' }}>
        {searchResults.length > 0 && selectedVoucher && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '20px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '16px'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#1f2937',
                margin: 0
              }}>
                교환권 정보
              </h2>
              <div style={{
                backgroundColor: getStatusColor(selectedVoucher.status),
                color: 'white',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                {getStatusText(selectedVoucher.status)}
              </div>
            </div>

            {/* 교환권 상세 정보 */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'grid',
                gap: '12px'
              }}>
                {selectedVoucher.voucher_templates && (
                  <div>
                    <label style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      fontWeight: '500'
                    }}>
                      교환권 템플릿
                    </label>
                    <p style={{
                      fontSize: '16px',
                      color: '#1f2937',
                      margin: '4px 0 0 0',
                      fontWeight: '600'
                    }}>
                      {selectedVoucher.voucher_templates.voucher_name} ({selectedVoucher.voucher_templates.voucher_type})
                    </p>
                  </div>
                )}

                <div>
                  <label style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    fontWeight: '500'
                  }}>
                    협회/단체명
                  </label>
                  <p style={{
                    fontSize: '16px',
                    color: '#1f2937',
                    margin: '4px 0 0 0',
                    fontWeight: '600'
                  }}>
                    {selectedVoucher.association}
                  </p>
                </div>

                <div>
                  <label style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    fontWeight: '500'
                  }}>
                    수혜자명
                  </label>
                  <p style={{
                    fontSize: '16px',
                    color: '#1f2937',
                    margin: '4px 0 0 0',
                    fontWeight: '600'
                  }}>
                    {selectedVoucher.name}
                  </p>
                </div>

                <div>
                  <label style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    fontWeight: '500'
                  }}>
                    금액
                  </label>
                  <p style={{
                    fontSize: '20px',
                    color: '#059669',
                    margin: '4px 0 0 0',
                    fontWeight: '700'
                  }}>
                    {selectedVoucher.amount.toLocaleString()}원
                  </p>
                </div>

                <div>
                  <label style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    fontWeight: '500'
                  }}>
                    일련번호
                  </label>
                  <p style={{
                    fontSize: '14px',
                    color: '#374151',
                    margin: '4px 0 0 0',
                    fontFamily: 'monospace',
                    backgroundColor: '#f3f4f6',
                    padding: '8px',
                    borderRadius: '6px',
                    wordBreak: 'break-all'
                  }}>
                    {selectedVoucher.serial_no}
                  </p>
                </div>

                <div>
                  <label style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    fontWeight: '500'
                  }}>
                    발행일시
                  </label>
                  <p style={{
                    fontSize: '16px',
                    color: '#1f2937',
                    margin: '4px 0 0 0'
                  }}>
                    {new Date(selectedVoucher.issued_at).toLocaleString()}
                  </p>
                </div>

                {selectedVoucher.used_at && (
                  <div>
                    <label style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      fontWeight: '500'
                    }}>
                      사용일시
                    </label>
                    <p style={{
                      fontSize: '16px',
                      color: '#1f2937',
                      margin: '4px 0 0 0'
                    }}>
                      {new Date(selectedVoucher.used_at).toLocaleString()}
                    </p>
                  </div>
                )}

                {selectedVoucher.usage_location && (
                  <div>
                    <label style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      fontWeight: '500'
                    }}>
                      사용처
                    </label>
                    <p style={{
                      fontSize: '16px',
                      color: '#1f2937',
                      margin: '4px 0 0 0'
                    }}>
                      {selectedVoucher.usage_location}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 새 검색 버튼 */}
            <button
              onClick={() => {
                setSearchInput('');
                setSearchResults([]);
                setSelectedVoucher(null);
              }}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500'
              }}
            >
              새로 검색하기
            </button>
          </div>
        )}

        {/* 검색 안내 */}
        {searchResults.length === 0 && !isSearching && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '40px 24px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '8px'
            }}>
              교환권을 검색해보세요
            </h3>
            <p style={{
              color: '#6b7280',
              fontSize: '16px',
              lineHeight: '1.5'
            }}>
              교환권 일련번호를 입력하거나<br/>
              QR 코드를 스캔하여 정보를 확인할 수 있습니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
}