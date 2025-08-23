'use client';

import React, { useState, useEffect, useRef } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { useAuth } from '@/lib/contexts/AuthContext';

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
  used_at_site_id?: string;
  usage_site?: {
    site_name: string;
  };
  notes?: string;
  template_id?: string;
  voucher_templates?: {
    voucher_name: string;
    voucher_type: string;
  };
}

interface VoucherTemplate {
  id: string;
  voucher_name: string;
  voucher_type: string;
  status: string;
}

export function VoucherInquiryContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  // 오늘 날짜 문자열 생성 (YYYY-MM-DD 형식)
  const today = new Date().toISOString().split('T')[0];
  
  const [vouchers, setVouchers] = useState<VoucherData[]>([]);
  const [templates, setTemplates] = useState<VoucherTemplate[]>([]);
  const [selectedVouchers, setSelectedVouchers] = useState<Set<string>>(new Set());
  const [showBulkEditPanel, setShowBulkEditPanel] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({
    usage_location: '',
    used_at: ''
  });
  const [searchFilters, setSearchFilters] = useState({
    serial_no: '',
    name: '',
    association: '',
    member_id: '',
    issued_date_from: '',     // 발행일은 기본값 없음
    issued_date_to: '',       // 발행일은 기본값 없음
    used_date_from: today,    // 사용일만 오늘 날짜로 기본값 설정
    used_date_to: today,      // 사용일만 오늘 날짜로 기본값 설정
    usage_location: ''
  });
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [usageLocations, setUsageLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [bulkEditLoading, setBulkEditLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrReaderRef = useRef<BrowserQRCodeReader | null>(null);

  // 템플릿 조회
  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/voucher-templates');
      const result = await response.json();
      if (result.success) {
        setTemplates(result.data || []);
      }
    } catch (error) {
      console.error('템플릿 조회 오류:', error);
    }
  };

  // 사용처 목록 조회
  const fetchUsageLocations = async () => {
    try {
      const response = await fetch('/api/vouchers/usage-locations');
      const result = await response.json();
      if (result.success) {
        setUsageLocations(result.data || []);
      }
    } catch (error) {
      console.error('사용처 목록 조회 오류:', error);
    }
  };

  // 교환권 조회
  const fetchVouchers = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });

      if (searchFilters.serial_no) params.append('serial_no', searchFilters.serial_no);
      if (searchFilters.name) params.append('name', searchFilters.name);
      if (searchFilters.association) params.append('association', searchFilters.association);
      if (searchFilters.member_id) params.append('member_id', searchFilters.member_id);
      if (searchFilters.issued_date_from) params.append('issued_date_from', searchFilters.issued_date_from);
      if (searchFilters.issued_date_to) params.append('issued_date_to', searchFilters.issued_date_to);
      if (searchFilters.used_date_from) params.append('used_date_from', searchFilters.used_date_from);
      if (searchFilters.used_date_to) params.append('used_date_to', searchFilters.used_date_to);
      if (searchFilters.usage_location) params.append('usage_location', searchFilters.usage_location);
      if (selectedTemplate) params.append('template_id', selectedTemplate);
      if (selectedStatus) params.append('status', selectedStatus);

      const response = await fetch(`/api/vouchers?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setVouchers(result.data || []);
        setCurrentPage(result.pagination?.page || 1);
        setTotalPages(result.pagination?.totalPages || 1);
        setTotalCount(result.pagination?.total || 0);
      }
    } catch (error) {
      console.error('교환권 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 검색 실행
  const handleSearch = () => {
    setSelectedVouchers(new Set()); // 검색 시 선택 초기화
    fetchVouchers(1);
  };

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(vouchers.map(v => v.id));
      setSelectedVouchers(allIds);
    } else {
      setSelectedVouchers(new Set());
    }
  };

  // 개별 선택/해제
  const handleSelectVoucher = (voucherId: string, checked: boolean) => {
    const newSelected = new Set(selectedVouchers);
    if (checked) {
      newSelected.add(voucherId);
    } else {
      newSelected.delete(voucherId);
    }
    setSelectedVouchers(newSelected);
  };

  // 일괄 수정 실행
  const handleBulkUpdate = async () => {
    if (selectedVouchers.size === 0) {
      alert('수정할 교환권을 선택해주세요.');
      return;
    }

    if (!bulkEditData.usage_location && !bulkEditData.used_at) {
      alert('변경할 사용처 또는 사용일을 입력해주세요.');
      return;
    }

    const confirmMessage = `선택한 ${selectedVouchers.size}개의 교환권을 수정하시겠습니까?\n` +
      (bulkEditData.usage_location ? `사용처: ${bulkEditData.usage_location}\n` : '') +
      (bulkEditData.used_at ? `사용일: ${bulkEditData.used_at}` : '');

    if (!confirm(confirmMessage)) {
      return;
    }

    setBulkEditLoading(true);
    try {
      const response = await fetch('/api/vouchers/bulk-update-usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voucher_ids: Array.from(selectedVouchers),
          usage_location: bulkEditData.usage_location || null,
          used_at: bulkEditData.used_at || null,
          user_id: user?.id
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(`${result.updated_count}개의 교환권이 수정되었습니다.`);
        setSelectedVouchers(new Set());
        setShowBulkEditPanel(false);
        setBulkEditData({ usage_location: '', used_at: '' });
        // 데이터 새로고침
        fetchVouchers(currentPage);
      } else {
        alert(result.message || '수정 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('일괄 수정 오류:', error);
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      setBulkEditLoading(false);
    }
  };

  // 필터 초기화
  const handleReset = () => {
    const today = new Date().toISOString().split('T')[0];
    setSearchFilters({
      serial_no: '',
      name: '',
      association: '',
      member_id: '',
      issued_date_from: '',     // 발행일은 기본값 없음
      issued_date_to: '',       // 발행일은 기본값 없음
      used_date_from: today,    // 사용일만 오늘 날짜로 설정
      used_date_to: today,      // 사용일만 오늘 날짜로 설정
      usage_location: ''
    });
    setSelectedTemplate('');
    setSelectedStatus('');
    setCurrentPage(1);
    setSelectedVouchers(new Set()); // 선택된 항목도 초기화
    fetchVouchers(1);
  };

  // 페이지 변경
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchVouchers(page);
  };

  // 상태 표시용 함수
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

  // 보고서 생성 함수
  const handleGenerateReport = () => {
    if (vouchers.length === 0) return;

    // 전체 데이터를 가져와서 보고서 생성
    generateReportWindow();
  };

  // 보고서 윈도우 생성
  const generateReportWindow = async () => {
    try {
      // 현재 필터 조건으로 모든 데이터 가져오기 (한도 없음)
      const params = new URLSearchParams({
        page: '1',
        limit: '50000' // 보고서용 대용량 한도
      });

      if (searchFilters.serial_no) params.append('serial_no', searchFilters.serial_no);
      if (searchFilters.name) params.append('name', searchFilters.name);
      if (searchFilters.association) params.append('association', searchFilters.association);
      if (searchFilters.member_id) params.append('member_id', searchFilters.member_id);
      if (searchFilters.issued_date_from) params.append('issued_date_from', searchFilters.issued_date_from);
      if (searchFilters.issued_date_to) params.append('issued_date_to', searchFilters.issued_date_to);
      if (searchFilters.used_date_from) params.append('used_date_from', searchFilters.used_date_from);
      if (searchFilters.used_date_to) params.append('used_date_to', searchFilters.used_date_to);
      if (searchFilters.usage_location) params.append('usage_location', searchFilters.usage_location);
      if (selectedTemplate) params.append('template_id', selectedTemplate);
      if (selectedStatus) params.append('status', selectedStatus);

      const response = await fetch(`/api/vouchers?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        const allVouchers = result.data || [];
        generateReportHTML(allVouchers);
      }
    } catch (error) {
      console.error('보고서 데이터 조회 오류:', error);
      alert('보고서 생성 중 오류가 발생했습니다.');
    }
  };

  // 보고서 HTML 생성 및 출력
  const generateReportHTML = (allVouchers: VoucherData[]) => {
    // 전체 통계 계산
    const totalCount = allVouchers.length;
    const totalAmount = allVouchers.reduce((sum, voucher) => sum + voucher.amount, 0);

    // 상태에 따른 보고서 제목 결정
    const getReportTitle = () => {
      if (selectedStatus === 'registered') return '교환권 등록내역 보고서';
      if (selectedStatus === 'issued') return '교환권 발행내역 보고서';
      if (selectedStatus === 'used') return '교환권 사용내역 보고서';
      if (selectedStatus === 'recalled') return '교환권 회수내역 보고서';
      if (selectedStatus === 'disposed') return '교환권 폐기내역 보고서';
      return '교환권 조회 보고서'; // 전체 또는 기타
    };

    // 상태에 따른 날짜 컬럼명 결정
    const getDateColumnNames = () => {
      if (selectedStatus === 'registered') return { issuedLabel: '등록일', usedLabel: '사용일' };
      if (selectedStatus === 'issued') return { issuedLabel: '발행일', usedLabel: '사용일' };
      if (selectedStatus === 'used') return { issuedLabel: '발행일', usedLabel: '사용일' };
      if (selectedStatus === 'recalled') return { issuedLabel: '발행일', usedLabel: '회수일' };
      if (selectedStatus === 'disposed') return { issuedLabel: '발행일', usedLabel: '폐기일' };
      return { issuedLabel: '발행일', usedLabel: '사용일' }; // 전체 또는 기타
    };

    const dateLabels = getDateColumnNames();

    // 사용처별 집계 (사용된 교환권만)
    const usageLocationGroups = allVouchers
      .filter(v => v.status === 'used' && v.usage_site?.site_name)
      .reduce((groups, voucher) => {
        const location = voucher.usage_site?.site_name || '미분류';
        if (!groups[location]) {
          groups[location] = { count: 0, amount: 0, vouchers: [] };
        }
        groups[location].count++;
        groups[location].amount += voucher.amount;
        groups[location].vouchers.push(voucher);
        return groups;
      }, {} as Record<string, { count: number; amount: number; vouchers: VoucherData[] }>);

    // 상태별 집계
    const statusGroups = allVouchers.reduce((groups, voucher) => {
      const status = voucher.status;
      if (!groups[status]) {
        groups[status] = { count: 0, amount: 0 };
      }
      groups[status].count++;
      groups[status].amount += voucher.amount;
      return groups;
    }, {} as Record<string, { count: number; amount: number }>);

    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>교환권 조회 보고서</title>
        <style>
          body { 
            font-family: 'Malgun Gothic', sans-serif; 
            margin: 20px; 
            color: #333;
            line-height: 1.6;
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
            padding-bottom: 20px;
            border-bottom: 2px solid #333;
          }
          .header h1 { 
            margin: 0; 
            font-size: 24px; 
            color: #2c3e50;
          }
          .header .date { 
            color: #666; 
            margin-top: 5px; 
          }
          .summary { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 25px;
            border-left: 4px solid #007bff;
          }
          .summary h2 { 
            margin-top: 0; 
            color: #2c3e50; 
            font-size: 18px;
          }
          .summary-item { 
            display: inline-block; 
            margin-right: 30px; 
            font-size: 16px;
          }
          .summary-item strong { 
            color: #2c3e50; 
          }
          .section { 
            margin-bottom: 25px; 
          }
          .section h3 { 
            background: #e9ecef; 
            padding: 10px 15px; 
            margin: 0 0 15px 0; 
            border-radius: 5px;
            color: #2c3e50;
            font-size: 16px;
          }
          .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
          }
          .status-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #dee2e6;
            text-align: center;
          }
          .status-card .count {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
          }
          .status-card .amount {
            font-size: 18px;
            color: #28a745;
            margin-top: 5px;
          }
          .status-card .label {
            color: #666;
            margin-top: 10px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px;
            background: white;
            font-size: 8pt;
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 4px; 
            text-align: center;
            font-size: 8pt;
          }
          th { 
            background-color: #f8f9fa; 
            font-weight: bold; 
            color: #2c3e50;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .subtotal { 
            background-color: #e3f2fd; 
            font-weight: bold; 
          }
          .total { 
            background-color: #bbdefb; 
            font-weight: bold; 
            font-size: 14px;
          }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${getReportTitle()}</h1>
          <div class="date">생성일시: ${new Date().toLocaleString('ko-KR')}</div>
        </div>

        <div class="summary" style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h2>📊 전체 현황</h2>
            <div class="summary-item">
              <strong>총 수량:</strong> ${totalCount.toLocaleString()}건
            </div>
            <div class="summary-item">
              <strong>총 금액:</strong> ${totalAmount.toLocaleString()}원
            </div>
          </div>
          <div class="approval-section" style="display: flex;">
            <div class="approval-box" style="border: 1px solid #333; text-align: center;">
              <div style="width: 12mm; height: 5mm; border-bottom: 1px solid #333; font-size: 8pt; display: flex; align-items: center; justify-content: center; font-weight: bold;">담당자</div>
              <div style="width: 12mm; height: 12mm; font-size: 8pt; display: flex; align-items: center; justify-content: center;"></div>
            </div>
            <div class="approval-box" style="border: 1px solid #333; border-left: none; text-align: center;">
              <div style="width: 12mm; height: 5mm; border-bottom: 1px solid #333; font-size: 8pt; display: flex; align-items: center; justify-content: center; font-weight: bold;">책임자</div>
              <div style="width: 12mm; height: 12mm; font-size: 8pt; display: flex; align-items: center; justify-content: center;"></div>
            </div>
          </div>
        </div>


        ${Object.keys(usageLocationGroups).length > 0 ? `
        <div class="section">
          <h3 style="text-align: center;">🏪 사용처별 현황</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 200px; text-align: center;">사용처</th>
                <th style="width: 100px;" class="text-center">수량</th>
                <th style="width: 120px;" class="text-center">금액</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(usageLocationGroups).map(([location, data]) => `
                <tr>
                  <td style="text-align: center;"><strong>${location}</strong></td>
                  <td class="text-center">${data.count.toLocaleString()}건</td>
                  <td style="text-align: right;">${data.amount.toLocaleString()}원</td>
                </tr>
              `).join('')}
              <tr class="total">
                <td style="text-align: center;"><strong>합계</strong></td>
                <td class="text-center"><strong>${Object.values(usageLocationGroups).reduce((sum, data) => sum + data.count, 0).toLocaleString()}건</strong></td>
                <td style="text-align: right;"><strong>${Object.values(usageLocationGroups).reduce((sum, data) => sum + data.amount, 0).toLocaleString()}원</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        ` : ''}

        <div class="section">
          <h3 style="text-align: center;">📋 교환권 목록</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 80px; text-align: center;">일련번호</th>
                <th style="width: 80px; text-align: center;">영농회</th>
                <th style="width: 60px; text-align: center;">조합원ID</th>
                <th style="width: 60px; text-align: center;">이름</th>
                <th style="width: 80px; text-align: center;">금액</th>
                <th style="width: 80px; text-align: center;">${dateLabels.issuedLabel}</th>
                <th style="width: 80px; text-align: center;">${dateLabels.usedLabel}</th>
                <th style="width: 100px; text-align: center;">사용처</th>
              </tr>
            </thead>
            <tbody>
              ${allVouchers.map(voucher => `
                <tr>
                  <td style="font-family: monospace; font-size: 8pt; text-align: center;">${voucher.serial_no}</td>
                  <td style="font-size: 8pt; text-align: center;">${voucher.association}</td>
                  <td style="font-size: 8pt; text-align: center;">${voucher.member_id}</td>
                  <td style="font-size: 8pt; text-align: center;"><strong>${voucher.name}</strong></td>
                  <td style="font-size: 8pt; text-align: right;"><strong>${voucher.amount.toLocaleString()}원</strong></td>
                  <td style="font-size: 8pt; text-align: center;">${voucher.issued_at ? new Date(voucher.issued_at).toLocaleDateString('ko-KR') : '-'}</td>
                  <td style="font-size: 8pt; text-align: center;">${voucher.used_at ? new Date(voucher.used_at).toLocaleDateString('ko-KR') : '-'}</td>
                  <td style="font-size: 8pt; text-align: center;">${voucher.usage_site?.site_name || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 40px; text-align: center; color: #666; font-size: 12px;">
          <p>※ 본 보고서는 ${new Date().toLocaleString('ko-KR')} 기준으로 생성되었습니다.</p>
        </div>

        <script>
          // 자동 인쇄 (선택사항)
          // window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    // 새 창에서 보고서 열기
    const reportWindow = window.open('', '_blank');
    if (reportWindow) {
      reportWindow.document.write(reportHTML);
      reportWindow.document.close();
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  // 초기 데이터 로드
  useEffect(() => {
    fetchTemplates();
    fetchUsageLocations();
  }, []);

  // 모바일 디바이스 감지
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // QR 스캐너 시작
  const startQrScanner = async () => {
    if (!videoRef.current) return;
    
    try {
      qrReaderRef.current = new BrowserQRCodeReader();
      const videoInputDevices = await BrowserQRCodeReader.listVideoInputDevices();
      
      // 후면 카메라 우선 선택
      const selectedDeviceId = videoInputDevices.find((device: any) => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear')
      )?.deviceId || videoInputDevices[0]?.deviceId;
      
      if (selectedDeviceId) {
        await qrReaderRef.current.decodeFromVideoDevice(
          selectedDeviceId,
          videoRef.current,
          (result, error) => {
            if (result) {
              handleQrScan(result.getText());
            }
          }
        );
      }
    } catch (error) {
      console.error('QR 스캐너 시작 오류:', error);
    }
  };

  // QR 스캐너 중지
  const stopQrScanner = () => {
    if (qrReaderRef.current) {
      qrReaderRef.current.stopContinuousDecode?.();
      qrReaderRef.current = null;
    }
  };

  // QR 코드 스캔 처리
  const handleQrScan = (data: string) => {
    if (data) {
      // QR 코드에서 일련번호 추출
      let serialNo = data;
      
      // HMAC 서명된 페이로드에서 일련번호 추출
      try {
        const payload = JSON.parse(data);
        if (payload.serial_no) {
          serialNo = payload.serial_no;
        }
      } catch {
        // JSON이 아니면 그대로 사용
      }
      
      setSearchFilters(prev => ({
        ...prev,
        serial_no: serialNo,
        name: '',
        association: '',
        member_id: ''
      }));
      setShowQrScanner(false);
      stopQrScanner();
      
      // 자동으로 검색 실행
      setTimeout(() => {
        handleSearch();
      }, 100);
    }
  };

  // QR 스캐너 모달 열기
  const openQrScanner = () => {
    setShowQrScanner(true);
    setTimeout(() => {
      startQrScanner();
    }, 100);
  };

  // QR 스캐너 모달 닫기
  const closeQrScanner = () => {
    setShowQrScanner(false);
    stopQrScanner();
  };

  // 초기 로드 - 템플릿과 사용처 목록만 로드
  useEffect(() => {
    fetchTemplates();
    // fetchVouchers(); // 초기 자동 조회 제거 - 검색 버튼을 눌러야 조회됨
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#1a202c',
          marginBottom: '8px'
        }}>
          교환권 조회
        </h2>
        <p style={{ color: '#6b7280' }}>
          발행된 교환권의 상태와 사용 내역을 조회합니다.
        </p>
      </div>

      {/* 검색 필터 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '24px'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#1a202c',
          marginBottom: '16px'
        }}>
          검색 필터
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '16px'
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '4px'
            }}>
              일련번호
            </label>
            <input
              type="text"
              value={searchFilters.serial_no}
              onChange={(e) => setSearchFilters(prev => ({...prev, serial_no: e.target.value}))}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="일련번호 입력"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '4px'
            }}>
              이름
            </label>
            <input
              type="text"
              value={searchFilters.name}
              onChange={(e) => setSearchFilters(prev => ({...prev, name: e.target.value}))}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="이름 입력"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '4px'
            }}>
              영농회
            </label>
            <input
              type="text"
              value={searchFilters.association}
              onChange={(e) => setSearchFilters(prev => ({...prev, association: e.target.value}))}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="영농회 입력"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '4px'
            }}>
              조합원ID
            </label>
            <input
              type="text"
              value={searchFilters.member_id}
              onChange={(e) => setSearchFilters(prev => ({...prev, member_id: e.target.value}))}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="조합원ID 입력"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '4px'
            }}>
              교환권 템플릿
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white',
                boxSizing: 'border-box',
                color: '#374151'
              }}
            >
              <option value="" style={{ color: '#374151' }}>전체</option>
              {templates.filter(t => t.status === 'active').map((template) => (
                <option key={template.id} value={template.id} style={{ color: '#374151' }}>
                  {template.voucher_name} ({template.voucher_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '4px'
            }}>
              상태
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white',
                boxSizing: 'border-box',
                color: '#374151'
              }}
            >
              <option value="" style={{ color: '#374151' }}>전체</option>
              <option value="registered" style={{ color: '#374151' }}>등록됨</option>
              <option value="issued" style={{ color: '#374151' }}>발행됨</option>
              <option value="used" style={{ color: '#374151' }}>사용됨</option>
              <option value="recalled" style={{ color: '#374151' }}>회수됨</option>
              <option value="disposed" style={{ color: '#374151' }}>폐기됨</option>
            </select>
          </div>
        </div>

        {/* 날짜 필터 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '12px',
          marginTop: '16px',
          padding: '16px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '4px'
            }}>
              📅 발행일 (시작)
            </label>
            <input
              type="date"
              value={searchFilters.issued_date_from}
              onChange={(e) => setSearchFilters(prev => ({...prev, issued_date_from: e.target.value}))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '4px'
            }}>
              📅 발행일 (종료)
            </label>
            <input
              type="date"
              value={searchFilters.issued_date_to}
              onChange={(e) => setSearchFilters(prev => ({...prev, issued_date_to: e.target.value}))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '4px'
            }}>
              🔖 사용일 (시작)
            </label>
            <input
              type="date"
              value={searchFilters.used_date_from}
              onChange={(e) => setSearchFilters(prev => ({...prev, used_date_from: e.target.value}))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '4px'
            }}>
              🔖 사용일 (종료)
            </label>
            <input
              type="date"
              value={searchFilters.used_date_to}
              onChange={(e) => setSearchFilters(prev => ({...prev, used_date_to: e.target.value}))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '4px'
            }}>
              🏪 사용처
            </label>
            <select
              value={searchFilters.usage_location}
              onChange={(e) => setSearchFilters(prev => ({...prev, usage_location: e.target.value}))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white',
                boxSizing: 'border-box',
                color: '#374151'
              }}
            >
              <option value="" style={{ color: '#374151' }}>전체 사용처</option>
              {usageLocations.map((location) => (
                <option key={location} value={location} style={{ color: '#374151' }}>
                  {location}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
          alignItems: 'center'
        }}>
          {isMobile && (
            <button
              onClick={openQrScanner}
              style={{
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📱 QR 스캔
            </button>
          )}
          <button
            onClick={handleReset}
            style={{
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            초기화
          </button>
          <button
            onClick={handleSearch}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            🔍 검색
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={vouchers.length === 0}
            style={{
              backgroundColor: vouchers.length === 0 ? '#f3f4f6' : '#10b981',
              color: vouchers.length === 0 ? '#9ca3af' : 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: vouchers.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            📊 보고서 출력
          </button>
        </div>
      </div>

      {/* 일괄 수정 패널 (관리자만, 선택된 항목이 있을 때) */}
      {isAdmin && selectedVouchers.size > 0 && (
        <div style={{
          backgroundColor: '#fef3c7',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          border: '1px solid #fbbf24'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#92400e'
            }}>
              일괄 수정 ({selectedVouchers.size}개 선택됨)
            </h3>
            <button
              onClick={() => {
                setSelectedVouchers(new Set());
                setShowBulkEditPanel(false);
                setBulkEditData({ usage_location: '', used_at: '' });
              }}
              style={{
                padding: '6px 12px',
                backgroundColor: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                color: '#374151'
              }}
            >
              취소
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px'
              }}>
                사용처 변경
              </label>
              <select
                value={bulkEditData.usage_location}
                onChange={(e) => setBulkEditData(prev => ({...prev, usage_location: e.target.value}))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  color: '#374151',
                  boxSizing: 'border-box'
                }}
              >
                <option value="" style={{ color: '#374151' }}>변경하지 않음</option>
                {usageLocations.map((location) => (
                  <option key={location} value={location} style={{ color: '#374151' }}>
                    {location}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px'
              }}>
                사용일 변경
              </label>
              <input
                type="date"
                value={bulkEditData.used_at}
                onChange={(e) => setBulkEditData(prev => ({...prev, used_at: e.target.value}))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'flex-end'
            }}>
              <button
                onClick={handleBulkUpdate}
                disabled={bulkEditLoading || (!bulkEditData.usage_location && !bulkEditData.used_at)}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  backgroundColor: bulkEditLoading || (!bulkEditData.usage_location && !bulkEditData.used_at) ? '#9ca3af' : '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: bulkEditLoading || (!bulkEditData.usage_location && !bulkEditData.used_at) ? 'not-allowed' : 'pointer'
                }}
              >
                {bulkEditLoading ? '처리 중...' : '일괄 수정'}
              </button>
            </div>
          </div>

          <p style={{
            fontSize: '12px',
            color: '#92400e',
            margin: 0
          }}>
            ⚠️ 선택한 교환권의 사용처와 사용일이 일괄 변경됩니다. 변경 사항은 감사 로그에 기록됩니다.
          </p>
        </div>
      )}

      {/* 결과 테이블 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px 24px',
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1a202c',
            margin: 0
          }}>
            검색 결과
          </h3>
          <span style={{
            fontSize: '14px',
            color: '#6b7280'
          }}>
            총 {totalCount.toLocaleString()}건
          </span>
        </div>

        {loading ? (
          <div style={{
            padding: '48px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            데이터를 불러오는 중...
          </div>
        ) : vouchers.length === 0 ? (
          <div style={{
            padding: '48px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            검색 결과가 없습니다.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  {isAdmin && (
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#374151',
                      borderBottom: '1px solid #e5e7eb',
                      fontSize: '14px',
                      width: '50px'
                    }}>
                      <input
                        type="checkbox"
                        checked={vouchers.length > 0 && selectedVouchers.size === vouchers.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                  )}
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    일련번호
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    교환권 템플릿
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    이름
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    영농회
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'right',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    금액
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    상태
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    발행일
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    사용일
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}>
                    사용처
                  </th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((voucher) => {
                  const statusStyle = getStatusColor(voucher.status);
                  const isSelected = selectedVouchers.has(voucher.id);
                  return (
                    <tr key={voucher.id} style={{
                      backgroundColor: isSelected ? '#f3f4f6' : 'transparent'
                    }}>
                      {isAdmin && (
                        <td style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #e5e7eb',
                          textAlign: 'center'
                        }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectVoucher(voucher.id, e.target.checked)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                      )}
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '14px',
                        fontFamily: 'monospace'
                      }}>
                        {voucher.serial_no}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '14px',
                        color: '#374151'
                      }}>
                        {voucher.voucher_templates ? 
                          `${voucher.voucher_templates.voucher_name} (${voucher.voucher_templates.voucher_type})` : 
                          '-'
                        }
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}>
                        {voucher.name}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '14px',
                        color: '#6b7280'
                      }}>
                        {voucher.association}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '14px',
                        textAlign: 'right',
                        fontWeight: '500'
                      }}>
                        {formatAmount(voucher.amount)}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        textAlign: 'center'
                      }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.color
                        }}>
                          {getStatusLabel(voucher.status)}
                        </span>
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '13px',
                        color: '#6b7280',
                        textAlign: 'center'
                      }}>
                        {formatDate(voucher.issued_at)}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '13px',
                        color: '#6b7280',
                        textAlign: 'center'
                      }}>
                        {formatDate(voucher.used_at)}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '14px',
                        color: '#374151'
                      }}>
                        {voucher.usage_site?.site_name || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div style={{
            padding: '16px 24px',
            backgroundColor: '#f9fafb',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{
              fontSize: '14px',
              color: '#6b7280'
            }}>
              페이지 {currentPage} / {totalPages}
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                  backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
                  color: currentPage === 1 ? '#9ca3af' : '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '12px'
                }}
              >
                이전
              </button>

              <span style={{
                padding: '6px 12px',
                fontSize: '12px',
                color: '#374151'
              }}>
                {currentPage}
              </span>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                  backgroundColor: currentPage === totalPages ? '#f3f4f6' : 'white',
                  color: currentPage === totalPages ? '#9ca3af' : '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '12px'
                }}
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QR 스캐너 모달 */}
      {showQrScanner && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1a202c',
                margin: 0
              }}>
                QR 코드 스캔
              </h3>
              <button
                onClick={closeQrScanner}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  fontSize: '24px',
                  padding: '0'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: '0 0 12px 0'
              }}>
                교환권의 QR 코드를 카메라에 맞춰주세요.
              </p>
              
              <div style={{
                width: '100%',
                height: '300px',
                backgroundColor: '#f3f4f6',
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <video
                  ref={videoRef}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                  playsInline
                  muted
                />
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              gap: '8px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={closeQrScanner}
                style={{
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}