'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useAuth } from '@/lib/contexts/AuthContext';
import { SiteCodeModal } from '../sites/SiteCodeModal';

interface VoucherInfo {
  serial_no: string;
  amount: number;
  association: string;
  name: string;
  status: string;
  scanned_at: string;
  error_message?: string;
  original_status?: string;
}

interface UsageResult {
  serial_no: string;
  success: boolean;
  message: string;
  usage_location?: string;
  usage_amount?: number;
  voucher_amount?: number;
  partial_use?: boolean;
  used_at?: string;
  previous_status?: string;
}

export function VoucherUsageContent() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);

  // 상태별 색상 반환
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'issued': return '#dcfce7'; // 연한 초록
      case 'used': return '#f3f4f6'; // 회색
      case 'recalled': return '#fef3c7'; // 연한 노랑
      case 'disposed': return '#fee2e2'; // 연한 빨강
      case 'registered': return '#dbeafe'; // 연한 파랑
      case 'error': return '#dc2626'; // 빨강
      default: return '#f3f4f6';
    }
  };

  // 상태별 텍스트 반환
  const getStatusText = (status: string, originalStatus?: string) => {
    if (status === 'error' && originalStatus) {
      switch (originalStatus) {
        case 'used': return '사용완료 (등록불가)';
        case 'recalled': return '회수됨 (등록불가)';
        case 'disposed': return '폐기됨 (등록불가)';
        case 'registered': return '미발행 (등록불가)';
        default: return '오류 (등록불가)';
      }
    }
    
    switch (status) {
      case 'issued': return '발행됨 (등록가능)';
      case 'used': return '사용완료';
      case 'recalled': return '회수됨';
      case 'disposed': return '폐기됨';
      case 'registered': return '미발행';
      case 'error': return '오류';
      default: return status;
    }
  };
  const [scanResult, setScanResult] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [usageLocation, setUsageLocation] = useState('');
  const [usageAmount, setUsageAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<UsageResult[]>([]);
  const [activeTab, setActiveTab] = useState<'scan' | 'manual' | 'bulk' | 'csv'>('scan');
  const [bulkSerialNos, setBulkSerialNos] = useState('');
  
  // 연속 스캔용 상태
  const [scannedVouchers, setScannedVouchers] = useState<VoucherInfo[]>([]);
  const [isLoadingVoucherInfo, setIsLoadingVoucherInfo] = useState(false);

  // 사업장 목록 상태
  const [sites, setSites] = useState<{id: string, site_name: string}[]>([]);
  const [isLoadingSites, setIsLoadingSites] = useState(false);

  // CSV 업로드 관련 상태
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [showSiteCodeModal, setShowSiteCodeModal] = useState(false);

  // 사업장 목록 가져오기
  const fetchSites = async () => {
    if (user?.role !== 'admin') return; // 관리자만 전체 사업장 목록 조회
    
    setIsLoadingSites(true);
    try {
      const response = await fetch('/api/sites');
      const data = await response.json();
      
      if (data.success) {
        setSites(data.data || []);
      } else {
        console.error('사업장 목록 조회 실패:', data.message);
      }
    } catch (error) {
      console.error('사업장 목록 조회 오류:', error);
    } finally {
      setIsLoadingSites(false);
    }
  };

  // 관리자인 경우 사업장 목록 로드, 일반 사용자는 자동 설정
  useEffect(() => {
    if (user?.role === 'admin') {
      fetchSites();
    } else if (user?.site_name && !usageLocation) {
      setUsageLocation(user.site_name);
    }
  }, [user, usageLocation]);

  // QR 스캔 초기화
  useEffect(() => {
    if (activeTab !== 'scan') return;

    const codeReader = new BrowserMultiFormatReader();
    let isMounted = true;

    const startScanning = async () => {
      try {
        setIsScanning(true);
        setCameraError('');
        
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!devices || devices.length === 0) {
          setCameraError('카메라를 찾을 수 없습니다. 수동 입력을 사용하세요.');
          return;
        }

        const deviceId = devices[0]?.deviceId;
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
  }, [activeTab, scannedVouchers]);

  // 개별 교환권 정보 조회 함수
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
        // 교환권 상태 검증
        const voucher = data.voucher;
        let statusError = null;
        
        switch (voucher.status) {
          case 'used':
            statusError = '이미 사용된 교환권입니다';
            break;
          case 'recalled':
            statusError = '회수된 교환권은 사용할 수 없습니다';
            break;
          case 'disposed':
            statusError = '폐기된 교환권은 사용할 수 없습니다';
            break;
          case 'registered':
            statusError = '아직 발행되지 않은 교환권입니다';
            break;
          case 'issued':
            // 정상 상태 - 사용 가능
            break;
          default:
            statusError = '사용할 수 없는 상태입니다';
        }

        const voucherInfo: VoucherInfo = {
          serial_no: serialNo,
          amount: voucher.amount,
          association: voucher.association,
          name: voucher.name,
          status: statusError ? 'error' : voucher.status,
          scanned_at: new Date().toISOString(),
          error_message: statusError ?? undefined,
          original_status: voucher.status
        };
        
        setScannedVouchers(prev => [...prev, voucherInfo]);
        
        // 상태 오류가 있는 경우 알림
        if (statusError) {
          alert(`교환권 ${serialNo}: ${statusError}`);
        }
      } else {
        // 조회 실패한 경우에도 목록에 추가 (오류 표시용)
        const voucherInfo: VoucherInfo = {
          serial_no: serialNo,
          amount: 0,
          association: '조회실패',
          name: data.error || '교환권 정보를 가져올 수 없습니다',
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

  // 스캔된 교환권 제거
  const removeScannedVoucher = (serialNo: string) => {
    setScannedVouchers(prev => prev.filter(v => v.serial_no !== serialNo));
  };

  // 스캔된 모든 교환권 클리어
  const clearScannedVouchers = () => {
    setScannedVouchers([]);
  };

  const handleSingleUsage = async () => {
    const serialNo = scanResult || manualInput;
    if (!serialNo.trim()) {
      alert('일련번호를 입력하거나 스캔해주세요.');
      return;
    }

    if (!usageLocation.trim()) {
      alert('사용처를 입력해주세요.');
      return;
    }

    setIsProcessing(true);
    setResults([]);

    try {
      const requestData: any = {
        serial_no: serialNo.trim(),
        usage_location: usageLocation.trim(),
        notes: notes.trim()
      };

      // 사용 금액이 입력된 경우 추가
      if (usageAmount.trim()) {
        const amount = parseFloat(usageAmount);
        if (isNaN(amount) || amount <= 0) {
          alert('올바른 사용 금액을 입력해주세요.');
          setIsProcessing(false);
          return;
        }
        requestData.usage_amount = amount;
      }

      // 고객 정보가 입력된 경우 추가
      if (customerName.trim() || customerPhone.trim()) {
        requestData.customer_info = {
          name: customerName.trim() || undefined,
          phone: customerPhone.trim() || undefined
        };
      }

      const response = await fetch('/api/vouchers/register-use', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();
      
      if (data.success) {
        setResults([{
          serial_no: serialNo,
          success: true,
          message: data.message,
          usage_location: data.data?.usage_location,
          usage_amount: data.data?.usage_amount,
          voucher_amount: data.data?.voucher_amount,
          partial_use: data.data?.partial_use,
          used_at: data.data?.used_at,
          previous_status: data.data?.previous_status
        }]);
        
        // 성공 시 입력 필드 초기화
        setScanResult('');
        setManualInput('');
        setUsageLocation('');
        setUsageAmount('');
        setCustomerName('');
        setCustomerPhone('');
        setNotes('');
      } else {
        setResults([{
          serial_no: serialNo,
          success: false,
          message: data.message
        }]);
      }
    } catch (error) {
      console.error('교환권 사용 등록 오류:', error);
      setResults([{
        serial_no: serialNo,
        success: false,
        message: '서버 오류가 발생했습니다.'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // 스캔된 교환권들 일괄 처리
  const handleScannedVouchersUsage = async () => {
    if (!usageLocation.trim()) {
      alert('사용처를 입력해주세요.');
      return;
    }

    // 유효한 교환권만 필터링 (사용 가능한 상태인 것만)
    const validVouchers = scannedVouchers.filter(v => v.status === 'issued');
    const invalidVouchers = scannedVouchers.filter(v => v.status !== 'issued');
    
    if (validVouchers.length === 0) {
      alert('사용 등록할 수 있는 교환권이 없습니다.\n발행된 상태의 교환권만 사용등록이 가능합니다.');
      return;
    }

    // 유효하지 않은 교환권이 있는 경우 확인
    if (invalidVouchers.length > 0) {
      const invalidList = invalidVouchers.map(v => 
        `${v.serial_no} (${getStatusText(v.status, v.original_status)})`
      ).join('\n');
      
      const proceed = confirm(
        `다음 교환권들은 사용등록할 수 없어 제외됩니다:\n\n${invalidList}\n\n계속 진행하시겠습니까?`
      );
      
      if (!proceed) {
        return;
      }
    }

    setIsProcessing(true);
    setResults([]);

    try {
      const voucherList = validVouchers.map(voucher => ({
        serial_no: voucher.serial_no,
        usage_location: usageLocation.trim(),
        usage_amount: usageAmount.trim() ? parseFloat(usageAmount) : undefined,
        notes: notes.trim() || undefined,
        customer_info: (customerName.trim() || customerPhone.trim()) ? {
          name: customerName.trim() || undefined,
          phone: customerPhone.trim() || undefined
        } : undefined
      }));

      console.log('사용등록 요청 데이터:', {
        vouchers: voucherList,
        site_id: user?.site_id,
        bulk_notes: notes.trim()
      });

      const response = await fetch(`/api/vouchers/bulk-register-use?userId=${user?.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vouchers: voucherList,
          site_id: user?.site_id,
          bulk_notes: notes.trim()
        })
      });

      console.log('응답 상태:', response.status, response.statusText);
      
      const data = await response.json();
      console.log('응답 데이터:', data);
      
      if (data.results) {
        setResults(data.results);
        if (data.success) {
          // 성공 시 스캔된 교환권 목록과 입력 필드 클리어
          clearScannedVouchers();
          setUsageAmount('');
          setCustomerName('');
          setCustomerPhone('');
          setNotes('');
        }
      } else {
        setResults([{
          serial_no: 'bulk_operation',
          success: false,
          message: data.message || '일괄 사용 등록에 실패했습니다.'
        }]);
      }
    } catch (error) {
      console.error('일괄 교환권 사용 등록 오류:', error);
      setResults([{
        serial_no: 'bulk_operation',
        success: false,
        message: '서버 오류가 발생했습니다.'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkUsage = async () => {
    if (!usageLocation.trim()) {
      alert('사용처를 입력해주세요.');
      return;
    }

    const serialNumbers = bulkSerialNos
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (serialNumbers.length === 0) {
      alert('사용 등록할 일련번호를 입력해주세요.');
      return;
    }

    setIsProcessing(true);
    setResults([]);

    try {
      const voucherList = serialNumbers.map(serial_no => ({
        serial_no,
        usage_location: usageLocation.trim(),
        usage_amount: usageAmount.trim() ? parseFloat(usageAmount) : undefined,
        notes: notes.trim() || undefined,
        customer_info: (customerName.trim() || customerPhone.trim()) ? {
          name: customerName.trim() || undefined,
          phone: customerPhone.trim() || undefined
        } : undefined
      }));

      const response = await fetch(`/api/vouchers/bulk-register-use?userId=${user?.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vouchers: voucherList,
          bulk_notes: notes.trim()
        })
      });

      const data = await response.json();
      
      if (data.results) {
        setResults(data.results);
        if (data.success) {
          setBulkSerialNos('');
          setUsageLocation('');
          setUsageAmount('');
          setCustomerName('');
          setCustomerPhone('');
          setNotes('');
        }
      } else {
        setResults([{
          serial_no: 'bulk_operation',
          success: false,
          message: data.message || '일괄 사용 등록에 실패했습니다.'
        }]);
      }
    } catch (error) {
      console.error('일괄 교환권 사용 등록 오류:', error);
      setResults([{
        serial_no: 'bulk_operation',
        success: false,
        message: '서버 오류가 발생했습니다.'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // CSV 업로드 처리
  const handleCsvUpload = async () => {
    if (!csvFile) {
      alert('CSV 파일을 선택해주세요.');
      return;
    }

    setIsUploadingCsv(true);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      if (user?.site_id) {
        formData.append('site_id', user.site_id);
      }
      if (notes.trim()) {
        formData.append('bulk_notes', notes.trim());
      }

      const response = await fetch('/api/vouchers/bulk-register-use-csv', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      // 디버깅을 위한 상세 로그
      console.log('CSV 업로드 응답:', {
        status: response.status,
        statusText: response.statusText,
        data: data
      });

      if (data.success) {
        setResults(data.results || []);
        setCsvFile(null);
        setNotes('');
        
        // 파일 입력 리셋
        const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
      } else {
        // 에러 정보를 더 자세히 표시
        console.error('CSV 업로드 실패 상세:', {
          message: data.message,
          errors: data.errors,
          totalErrors: data.totalErrors,
          availableSiteCodes: data.availableSiteCodes,
          expectedFormat: data.expectedFormat,
          failedSamples: data.failedSamples,
          summary: data.summary
        });
        
        setResults([{
          serial_no: 'csv_upload',
          success: false,
          message: data.message || 'CSV 업로드에 실패했습니다.',
          ...data.errors ? { errors: data.errors } : {}
        }]);
      }
    } catch (error) {
      console.error('CSV 업로드 오류:', error);
      setResults([{
        serial_no: 'csv_upload',
        success: false,
        message: '서버 오류가 발생했습니다.'
      }]);
    } finally {
      setIsUploadingCsv(false);
    }
  };

  // CSV 템플릿 다운로드
  const downloadCsvTemplate = () => {
    const csvContent = `일련번호,사용일자,사용처코드,비고
2410110001,2025-08-20,TG,정상사용
2410110002,2025-08-20,DH,부분사용
2410110003,2025-08-21,JB,`;
    
    // UTF-8 BOM 추가 (Excel에서 한글 깨짐 방지)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'voucher_usage_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div>
      <h2 style={{
        fontSize: '28px',
        fontWeight: 'bold',
        color: '#1a202c',
        marginBottom: '24px'
      }}>
        교환권 사용 등록
      </h2>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>
        고객이 교환권을 사용했을 때 시스템에 등록합니다. QR 스캔 또는 수동 입력이 가능합니다.
      </p>

      {/* 탭 메뉴 */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <button
          onClick={() => setActiveTab('scan')}
          style={{
            padding: '12px 20px',
            backgroundColor: 'transparent',
            color: activeTab === 'scan' ? '#3b82f6' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'scan' ? '2px solid #3b82f6' : '2px solid transparent',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          📱 QR 스캔
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          style={{
            padding: '12px 20px',
            backgroundColor: 'transparent',
            color: activeTab === 'manual' ? '#3b82f6' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'manual' ? '2px solid #3b82f6' : '2px solid transparent',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          ⌨️ 수동 입력
        </button>
        <button
          onClick={() => setActiveTab('bulk')}
          style={{
            padding: '12px 20px',
            backgroundColor: 'transparent',
            color: activeTab === 'bulk' ? '#3b82f6' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'bulk' ? '2px solid #3b82f6' : '2px solid transparent',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          📋 일괄 등록
        </button>
        <button
          onClick={() => setActiveTab('csv')}
          style={{
            padding: '12px 20px',
            backgroundColor: 'transparent',
            color: activeTab === 'csv' ? '#3b82f6' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'csv' ? '2px solid #3b82f6' : '2px solid transparent',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          📁 CSV 업로드
        </button>
      </div>

      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '24px'
      }}>
        {/* QR 스캔 탭 */}
        {activeTab === 'scan' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                연속 QR 코드 스캔
              </h3>
              {scannedVouchers.length > 0 && (
                <button
                  onClick={clearScannedVouchers}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#f87171',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  목록 클리어
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '16px' }}>
              {/* 카메라 영역 */}
              <div>
                {cameraError ? (
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#fff3cd',
                    border: '1px solid #ffeaa7',
                    borderRadius: '8px',
                    color: '#856404'
                  }}>
                    {cameraError}
                  </div>
                ) : (
                  <div>
                    <video 
                      ref={videoRef} 
                      style={{
                        width: '100%', 
                        background: '#000', 
                        borderRadius: 8,
                        border: isScanning ? '3px solid #28a745' : '3px solid #ddd'
                      }} 
                    />
                    {isScanning && (
                      <div style={{ textAlign: 'center', marginTop: 8, color: '#28a745', fontSize: '14px' }}>
                        📱 QR 코드를 카메라에 비춰주세요<br/>
                        스캔된 교환권이 우측에 표시됩니다
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 스캔된 교환권 목록 */}
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                  스캔된 교환권 ({scannedVouchers.length}개)
                  {scannedVouchers.length > 0 && (
                    <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#6b7280' }}>
                      {' - '}사용가능: {scannedVouchers.filter(v => v.status === 'issued').length}개
                      {scannedVouchers.filter(v => v.status === 'error').length > 0 && 
                        `, 오류: ${scannedVouchers.filter(v => v.status === 'error').length}개`
                      }
                    </span>
                  )}
                  {isLoadingVoucherInfo && <span style={{ color: '#3b82f6', fontSize: '14px' }}> - 조회 중...</span>}
                </h4>
                <div style={{ 
                  maxHeight: '300px', 
                  overflowY: 'auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: '#f9fafb'
                }}>
                  {scannedVouchers.length === 0 ? (
                    <div style={{ 
                      padding: '40px 20px', 
                      textAlign: 'center', 
                      color: '#6b7280' 
                    }}>
                      QR 코드를 스캔하면<br/>이곳에 교환권 정보가 표시됩니다
                    </div>
                  ) : (
                    scannedVouchers.map((voucher, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '12px',
                          borderBottom: index < scannedVouchers.length - 1 ? '1px solid #e5e7eb' : 'none',
                          backgroundColor: voucher.status === 'error' ? '#fef2f2' : 'white',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontFamily: 'monospace', 
                            fontSize: '12px', 
                            color: '#6b7280',
                            marginBottom: '4px'
                          }}>
                            {voucher.serial_no}
                          </div>
                          <div style={{ fontWeight: '600', marginBottom: '2px' }}>
                            {voucher.association} - {voucher.name}
                          </div>
                          <div style={{ 
                            fontSize: '14px', 
                            color: voucher.status === 'error' ? '#dc2626' : '#374151'
                          }}>
                            {voucher.status === 'error' 
                              ? (voucher.error_message || voucher.name)
                              : `${voucher.amount.toLocaleString()}원`
                            }
                          </div>
                          {/* 상태 표시 */}
                          <div style={{
                            fontSize: '12px',
                            marginTop: '4px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            display: 'inline-block',
                            backgroundColor: getStatusColor(voucher.status),
                            color: voucher.status === 'error' ? 'white' : '#374151'
                          }}>
                            {getStatusText(voucher.status, voucher.original_status)}
                          </div>
                        </div>
                        <button
                          onClick={() => removeScannedVoucher(voucher.serial_no)}
                          style={{
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: '#6b7280',
                            cursor: 'pointer',
                            fontSize: '16px',
                            padding: '4px'
                          }}
                        >
                          ❌
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 수동 입력 탭 */}
        {activeTab === 'manual' && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              수동 입력
            </h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                일련번호 *
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => {
                    setManualInput(e.target.value);
                    setScanResult(''); // 수동 입력 시 스캔 결과 초기화
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && manualInput.trim()) {
                      handleVoucherScan(manualInput.trim());
                      setManualInput('');
                    }
                  }}
                  placeholder="교환권 일련번호를 입력하세요"
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontFamily: 'monospace'
                  }}
                />
                <button
                  onClick={() => {
                    if (manualInput.trim()) {
                      handleVoucherScan(manualInput.trim());
                      setManualInput('');
                    }
                  }}
                  disabled={!manualInput.trim()}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: manualInput.trim() ? '#3b82f6' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    cursor: manualInput.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  추가
                </button>
              </div>
              <small style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                * Enter 키를 누르거나 추가 버튼을 클릭하여 목록에 추가할 수 있습니다
              </small>
            </div>

            {/* 스캔된 교환권 목록 (수동 입력 탭에서도 표시) */}
            {scannedVouchers.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                    추가된 교환권 ({scannedVouchers.length}개)
                  </h4>
                  <button
                    onClick={clearScannedVouchers}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#f87171',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    목록 클리어
                  </button>
                </div>
                <div style={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: '#f9fafb'
                }}>
                  {scannedVouchers.map((voucher, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '8px 12px',
                        borderBottom: index < scannedVouchers.length - 1 ? '1px solid #e5e7eb' : 'none',
                        backgroundColor: voucher.status === 'error' ? '#fef2f2' : 'white',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: '600',
                          color: voucher.status === 'error' ? '#dc2626' : '#374151'
                        }}>
                          {voucher.association} - {voucher.name}
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#6b7280',
                          fontFamily: 'monospace'
                        }}>
                          {voucher.serial_no} | {voucher.status === 'error' 
                            ? voucher.name 
                            : `${voucher.amount.toLocaleString()}원`
                          }
                        </div>
                      </div>
                      <button
                        onClick={() => removeScannedVoucher(voucher.serial_no)}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: '#6b7280',
                          cursor: 'pointer',
                          fontSize: '14px',
                          padding: '4px'
                        }}
                      >
                        ❌
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 일괄 등록 탭 */}
        {activeTab === 'bulk' && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              일괄 사용 등록
            </h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                일련번호 목록 (한 줄에 하나씩) *
              </label>
              <textarea
                value={bulkSerialNos}
                onChange={(e) => setBulkSerialNos(e.target.value)}
                placeholder={`교환권 일련번호를 한 줄에 하나씩 입력하세요:\nVCH:12345|TS:202412131200|SIG:abc123\nVCH:12346|TS:202412131201|SIG:def456`}
                rows={6}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>
        )}

        {/* CSV 업로드 탭 */}
        {activeTab === 'csv' && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              CSV 파일 업로드
            </h3>
            
            {/* 도움말 및 템플릿 다운로드 */}
            <div style={{
              backgroundColor: '#f0f9ff',
              border: '1px solid #0ea5e9',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#0369a1' }}>
                📋 CSV 파일 형식 안내
              </h4>
              <p style={{ fontSize: '13px', color: '#0369a1', marginBottom: '8px' }}>
                CSV 파일은 다음 형식으로 작성해주세요: <strong>일련번호, 사용일자, 사용처코드, 비고</strong>
              </p>
              <p style={{ fontSize: '13px', color: '#0369a1', marginBottom: '12px' }}>
                • 사용일자: YYYY-MM-DD 또는 YYYY/MM/DD 형식<br/>
                • 사용처코드: 각 사업장의 간략 코드 (예: TG, DH, JB)<br/>
                • 비고: 선택사항
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={downloadCsvTemplate}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#0ea5e9',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  📥 템플릿 다운로드
                </button>
                <button
                  onClick={() => setShowSiteCodeModal(true)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  📋 사업장 코드표 보기
                </button>
              </div>
            </div>

            {/* 파일 선택 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                CSV 파일 선택 *
              </label>
              <input
                id="csv-file-input"
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setCsvFile(file);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px dashed #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: '#f9fafb'
                }}
              />
              {csvFile && (
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  선택된 파일: {csvFile.name} ({Math.round(csvFile.size / 1024)}KB)
                </p>
              )}
            </div>

            {/* 일괄 비고 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                일괄 비고 (선택사항)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="모든 교환권에 공통으로 추가할 비고를 입력하세요"
                rows={2}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* 업로드 버튼 */}
            <button
              onClick={handleCsvUpload}
              disabled={!csvFile || isUploadingCsv}
              style={{
                padding: '12px 24px',
                backgroundColor: (!csvFile || isUploadingCsv) ? '#9ca3af' : '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: (!csvFile || isUploadingCsv) ? 'not-allowed' : 'pointer',
                opacity: (!csvFile || isUploadingCsv) ? 0.6 : 1
              }}
            >
              {isUploadingCsv ? (
                <>
                  <span>⏳</span> 처리 중...
                </>
              ) : (
                <>
                  <span>📁</span> CSV 업로드
                </>
              )}
            </button>
          </div>
        )}

        {/* 공통 사용 정보 입력 (CSV 탭 제외) */}
        {activeTab !== 'csv' && (
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
            사용 정보
          </h4>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              사용처 *
            </label>
            
            {user?.role === 'admin' ? (
              // 관리자: 드롭다운으로 전체 사업장 선택
              <select
                value={usageLocation}
                onChange={(e) => setUsageLocation(e.target.value)}
                disabled={isLoadingSites}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: 'white',
                  cursor: isLoadingSites ? 'wait' : 'pointer',
                  color: '#374151'
                }}
              >
                <option value="">사업장을 선택하세요</option>
                {sites.map(site => (
                  <option key={site.id} value={site.site_name}>
                    {site.site_name}
                  </option>
                ))}
                {user?.site_name && !sites.find(site => site.site_name === user.site_name) && (
                  <option value={user.site_name}>
                    {user.site_name} (현재 사업장)
                  </option>
                )}
              </select>
            ) : (
              // 일반 사용자: 텍스트 입력 (기본값 자동 설정)
              <input
                type="text"
                value={usageLocation}
                onChange={(e) => setUsageLocation(e.target.value)}
                placeholder={user?.site_name ? `기본값: ${user.site_name}` : "예: 본점, 강남점, 온라인몰 등"}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: user?.site_name && usageLocation === user.site_name ? '#f0f9ff' : 'white'
                }}
              />
            )}

            {user?.role === 'admin' ? (
              <small style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                * 관리자는 모든 사업장을 선택할 수 있습니다
                {isLoadingSites && ' (사업장 목록 로딩 중...)'}
              </small>
            ) : user?.site_name ? (
              <small style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                * 현재 사업장 ({user.site_name})이 자동으로 설정됩니다
              </small>
            ) : null}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              사용 금액 (선택사항)
            </label>
            <input
              type="number"
              value={usageAmount}
              onChange={(e) => setUsageAmount(e.target.value)}
              placeholder="부분 사용시 실제 사용한 금액을 입력하세요"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '16px'
              }}
            />
            <small style={{ color: '#6b7280', fontSize: '12px' }}>
              * 입력하지 않으면 전액 사용으로 처리됩니다
            </small>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                고객명 (선택사항)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="고객명을 입력하세요"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                고객 연락처 (선택사항)
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="010-1234-5678"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              참고사항 (선택사항)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="추가 참고사항이 있으면 입력하세요"
              rows={3}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '16px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* 탭별 다른 버튼 */}
          {(activeTab === 'scan' || activeTab === 'manual') ? (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleScannedVouchersUsage}
                disabled={isProcessing || scannedVouchers.filter(v => v.status !== 'error').length === 0}
                style={{
                  backgroundColor: isProcessing || scannedVouchers.filter(v => v.status !== 'error').length === 0 
                    ? '#9ca3af' 
                    : '#16a34a',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isProcessing || scannedVouchers.filter(v => v.status !== 'error').length === 0 
                    ? 'not-allowed' 
                    : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flex: 1
                }}
              >
                {isProcessing ? '처리 중...' : (
                  <>
                    <span>✅</span>
                    {activeTab === 'scan' 
                      ? `스캔된 교환권 일괄 사용 등록 (${scannedVouchers.filter(v => v.status !== 'error').length}개)`
                      : `추가된 교환권 일괄 사용 등록 (${scannedVouchers.filter(v => v.status !== 'error').length}개)`
                    }
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setScanResult('');
                  setManualInput('');
                  setActiveTab('manual');
                }}
                style={{
                  backgroundColor: '#6b7280',
                  color: 'white',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                수동 입력으로 변경
              </button>
            </div>
          ) : (
            <button
              onClick={activeTab === 'bulk' ? handleBulkUsage : handleSingleUsage}
              disabled={isProcessing}
              style={{
                backgroundColor: isProcessing ? '#9ca3af' : '#16a34a',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isProcessing ? '처리 중...' : (
                <>
                  <span>✅</span>
                  {activeTab === 'bulk' ? '일괄 사용 등록' : '사용 등록'}
                </>
              )}
            </button>
          )}
        </div>
        )}
      </div>

      {/* 결과 표시 */}
      {results.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
            처리 결과
          </h4>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {results.map((result, index) => (
              <div
                key={index}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  backgroundColor: result.success ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${result.success ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: '8px'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px'
                }}>
                  <span style={{ fontSize: '16px' }}>
                    {result.success ? '✅' : '❌'}
                  </span>
                  <strong style={{ fontFamily: 'monospace' }}>
                    {result.serial_no}
                  </strong>
                  {result.used_at && (
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      ({new Date(result.used_at).toLocaleString()})
                    </span>
                  )}
                </div>
                <p style={{
                  margin: 0,
                  color: result.success ? '#15803d' : '#dc2626',
                  fontSize: '14px'
                }}>
                  {result.message}
                </p>
                {result.success && result.usage_location && (
                  <p style={{
                    margin: '4px 0 0 0',
                    color: '#6b7280',
                    fontSize: '12px'
                  }}>
                    사용처: {result.usage_location}
                    {result.usage_amount && result.voucher_amount && (
                      <span>
                        {' '}| 사용금액: {result.usage_amount.toLocaleString()}원
                        {result.partial_use && ` (전체: ${result.voucher_amount.toLocaleString()}원)`}
                      </span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 사업장 코드표 모달 */}
      <SiteCodeModal
        isOpen={showSiteCodeModal}
        onClose={() => setShowSiteCodeModal(false)}
        isAdminMode={user?.role === 'admin'}
      />
    </div>
  );
}