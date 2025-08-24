'use client';

import React, { useState, useEffect } from 'react';

interface DesignTemplate {
  id: string;
  name: string;
  description?: string;
  a4_image_url: string;
  mobile_image_url: string;
  is_active: boolean;
  created_at: string;
}

interface VoucherTemplate {
  id: string;
  voucher_name: string;
  voucher_type: string;
  status: string;
}

interface VoucherRecipient {
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
  notes?: string;
  template_id?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function VoucherIssueForm() {
  const [designTemplates, setDesignTemplates] = useState<DesignTemplate[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRecipient[]>([]);
  const [voucherTemplates, setVoucherTemplates] = useState<VoucherTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedVoucherTemplate, setSelectedVoucherTemplate] = useState('');
  const [selectedVouchers, setSelectedVouchers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [format, setFormat] = useState<'a4' | 'mobile'>('a4');
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);
  
  // 페이징 상태
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  // 필터 상태
  const [filters, setFilters] = useState({
    serial_no: '',
    name: '',
    association: '',
    member_id: '',
    status: 'issuable' // 발행 가능한 교환권 (registered + issued)
  });

  // 디자인 템플릿 목록 조회
  const fetchDesignTemplates = async () => {
    try {
      const response = await fetch('/api/voucher-design-templates?is_active=true');
      const result = await response.json();
      
      if (result.success) {
        setDesignTemplates(result.data);
      } else {
        setMessage({ type: 'error', text: result.message || '디자인 템플릿 조회에 실패했습니다.' });
      }
    } catch (error) {
      console.error('디자인 템플릿 조회 오류:', error);
      setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    }
  };

  // 교환권 템플릿 목록 조회
  const fetchVoucherTemplates = async () => {
    try {
      const response = await fetch('/api/voucher-templates');
      const result = await response.json();
      
      if (result.success) {
        setVoucherTemplates(result.data || []);
      }
    } catch (error) {
      console.error('교환권 템플릿 조회 오류:', error);
    }
  };

  // 교환권 목록 조회
  const fetchVouchers = async (page = pagination.page) => {
    if (!selectedVoucherTemplate) {
      setVouchers([]);
      return;
    }
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      });

      // 템플릿 ID 필터 추가 (필수)
      params.append('template_id', selectedVoucherTemplate);

      // 필터 추가
      if (filters.serial_no) params.append('serial_no', filters.serial_no);
      if (filters.name) params.append('name', filters.name);
      if (filters.association) params.append('association', filters.association);
      if (filters.member_id) params.append('member_id', filters.member_id);
      if (filters.status) params.append('status', filters.status);

      const response = await fetch(`/api/vouchers?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setVouchers(result.data || []);
        setPagination(result.pagination || pagination);
        setSelectedVouchers([]); // 새 조회 시 선택 초기화
        setSelectAll(false);
      } else {
        setMessage({ type: 'error', text: result.message || '교환권 조회에 실패했습니다.' });
      }
    } catch (error) {
      console.error('교환권 조회 오류:', error);
      setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 전체 선택 토글 (템플릿의 모든 교환권)
  const handleSelectAll = async () => {
    if (selectAll) {
      setSelectedVouchers([]);
      setSelectAll(false);
    } else {
      // 템플릿의 모든 교환권을 가져와서 선택
      try {
        const params = new URLSearchParams({
          page: '1',
          limit: '999999' // 모든 데이터 가져오기
        });

        // 템플릿 ID 필터 추가 (필수)
        params.append('template_id', selectedVoucherTemplate);

        // 현재 필터들도 적용
        if (filters.serial_no) params.append('serial_no', filters.serial_no);
        if (filters.name) params.append('name', filters.name);
        if (filters.association) params.append('association', filters.association);
        if (filters.member_id) params.append('member_id', filters.member_id);
        if (filters.status) params.append('status', filters.status);

        const response = await fetch(`/api/vouchers?${params.toString()}`);
        const result = await response.json();
        
        if (result.success) {
          const allVoucherIds = (result.data || []).map((v: any) => v.id);
          setSelectedVouchers(allVoucherIds);
          setSelectAll(true);
        }
      } catch (error) {
        console.error('전체 선택 오류:', error);
        setMessage({ type: 'error', text: '전체 선택 중 오류가 발생했습니다.' });
      }
    }
  };

  // 개별 선택 토글
  const handleSelectVoucher = (voucherId: string) => {
    setSelectedVouchers(prev => {
      if (prev.includes(voucherId)) {
        return prev.filter(id => id !== voucherId);
      }
      return [...prev, voucherId];
    });
  };

  // 교환권 상태 업데이트 함수
  const updateVoucherStatus = async (voucherIds: string[], status: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/vouchers/bulk-update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voucher_ids: voucherIds,
          status: status
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 리스트 갱신
          await fetchVouchers(pagination.page);
          return true;
        } else {
          console.error('상태 업데이트 실패:', result.message);
          return false;
        }
      } else {
        console.error('상태 업데이트 HTTP 실패:', response.status);
        return false;
      }
    } catch (error) {
      console.error('상태 업데이트 오류:', error);
      return false;
    }
  };

  // 일괄 PDF 생성 및 다운로드 (1000개씩 순차 처리)
  const handleBulkPrint = async () => {
    if (!selectedTemplate) {
      setMessage({ type: 'error', text: '디자인 템플릿을 선택해주세요.' });
      return;
    }

    if (selectedVouchers.length === 0) {
      setMessage({ type: 'error', text: '인쇄할 교환권을 선택해주세요.' });
      return;
    }

    setIsGenerating(true);
    
    const BATCH_SIZE = 1000; // 한 번에 처리할 최대 개수
    const totalBatches = Math.ceil(selectedVouchers.length / BATCH_SIZE);
    
    try {
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, selectedVouchers.length);
        const batchVouchers = selectedVouchers.slice(start, end);
        
        setMessage({ 
          type: 'info', 
          text: `DB 발행일자 업데이트 중... (${batchIndex + 1}/${totalBatches} 배치, ${start + 1}-${end}/${selectedVouchers.length}개)` 
        });

        // 먼저 DB에서 발행 상태 및 발행일자 업데이트
        const updateResult = await updateVoucherStatus(batchVouchers, 'issued');
        if (!updateResult) {
          setMessage({ 
            type: 'error', 
            text: `배치 ${batchIndex + 1} DB 업데이트 실패` 
          });
          continue; // 다음 배치로 계속 진행
        }

        setMessage({ 
          type: 'info', 
          text: `PDF 생성 중... (${batchIndex + 1}/${totalBatches} 배치, ${start + 1}-${end}/${selectedVouchers.length}개)` 
        });

        const response = await fetch('/api/vouchers/bulk-print', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            voucher_ids: batchVouchers,
            template_id: selectedTemplate,
            format: format,
            batch_info: {
              current: batchIndex + 1,
              total: totalBatches,
              start: start + 1,
              end: end
            }
          }),
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          
          if (contentType?.includes('text/html')) {
            // HTML로 새 창 열기
            const html = await response.text();
            const printWindow = window.open('', `_blank_batch_${batchIndex}`);
            if (printWindow) {
              printWindow.document.write(html);
              printWindow.document.close();
              
              // 다음 배치 처리 전 잠시 대기 (브라우저 부하 방지)
              if (batchIndex < totalBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          } else {
            // PDF 다운로드 (fallback)
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `vouchers-${format}-batch${batchIndex + 1}-${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          }
        } else {
          const result = await response.json();
          setMessage({ 
            type: 'error', 
            text: `배치 ${batchIndex + 1} PDF 생성 실패: ${result.message || 'PDF 생성에 실패했습니다. (DB는 업데이트됨)'}` 
          });
          // 오류 발생 시 중단할지 계속할지 사용자에게 확인
          if (batchIndex < totalBatches - 1) {
            const continueProcess = window.confirm(
              `배치 ${batchIndex + 1}/${totalBatches} PDF 생성 중 오류가 발생했습니다.\nDB는 이미 업데이트되었습니다. 계속 진행하시겠습니까?`
            );
            if (!continueProcess) {
              break;
            }
          }
        }
      }
      
      setMessage({ 
        type: 'success', 
        text: `총 ${selectedVouchers.length}개의 교환권이 ${totalBatches}개 배치로 처리되었습니다.` 
      });
      
    } catch (error) {
      console.error('PDF 생성 오류:', error);
      setMessage({ type: 'error', text: 'PDF 생성 중 오류가 발생했습니다.' });
    } finally {
      setIsGenerating(false);
    }
  };

  // 필터 적용
  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  // 필터 검색
  const handleSearch = () => {
    fetchVouchers(1); // 첫 페이지부터 검색
  };

  // 필터 초기화
  const handleResetFilters = () => {
    setFilters({
      serial_no: '',
      name: '',
      association: '',
      member_id: '',
      status: 'registered'
    });
    fetchVouchers(1);
  };

  // 개별 PDF 생성 (기존 단일 PDF 생성)
  const handleGeneratePDF = async (voucherId: string) => {
    // 단일 교환권 PDF 생성 로직
    console.log('Generate PDF for voucher:', voucherId);
    // TODO: Implement single voucher PDF generation
  };

  useEffect(() => {
    fetchDesignTemplates();
    fetchVoucherTemplates();
  }, []);

  useEffect(() => {
    if (selectedVoucherTemplate) {
      fetchVouchers();
    } else {
      setVouchers([]);
      setSelectedVouchers([]);
      setSelectAll(false);
      setPagination({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      });
    }
  }, [selectedVoucherTemplate]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // 전체 선택 상태 업데이트
  useEffect(() => {
    setSelectAll(vouchers.length > 0 && selectedVouchers.length === vouchers.length);
  }, [selectedVouchers, vouchers]);

  return (
    <div>
      <h3 style={{
        fontSize: '20px',
        fontWeight: '600',
        color: '#1a202c',
        marginBottom: '16px'
      }}>
        교환권 발행(인쇄)
      </h3>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>
        등록된 교환권을 선택하여 PDF로 발행하고 인쇄할 수 있습니다.
      </p>

      {/* 메시지 표시 */}
      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '6px',
          marginBottom: '16px',
          backgroundColor: 
            message.type === 'success' ? '#dcfce7' : 
            message.type === 'info' ? '#dbeafe' : '#fee2e2',
          color: 
            message.type === 'success' ? '#16a34a' : 
            message.type === 'info' ? '#2563eb' : '#dc2626',
          border: `1px solid ${
            message.type === 'success' ? '#bbf7d0' : 
            message.type === 'info' ? '#bfdbfe' : '#fecaca'
          }`
        }}>
          {message.text}
        </div>
      )}

      {/* 디자인 템플릿 및 포맷 선택 */}
      <div style={{
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '24px'
      }}>
        <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1a202c', marginBottom: '12px' }}>
          발행 설정
        </h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
              교환권 템플릿 *
            </label>
            <select
              value={selectedVoucherTemplate}
              onChange={(e) => setSelectedVoucherTemplate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white',
                color: '#374151'
              }}
            >
              <option value="">교환권 템플릿 선택</option>
              {voucherTemplates.filter(t => t.status === 'active').map((template) => (
                <option key={template.id} value={template.id}>
                  {template.voucher_name} ({template.voucher_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
              디자인 템플릿 *
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
                color: '#374151'
              }}
            >
              <option value="">디자인 템플릿 선택</option>
              {designTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
              출력 형식
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'a4' | 'mobile')}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white',
                color: '#374151'
              }}
            >
              <option value="a4">A4 (프린터용)</option>
              <option value="mobile">모바일 (정사각형)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button
              onClick={handleBulkPrint}
              disabled={isGenerating || !selectedTemplate || selectedVouchers.length === 0}
              style={{
                backgroundColor: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '9px 16px',
                cursor: (isGenerating || !selectedTemplate || selectedVouchers.length === 0) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: (isGenerating || !selectedTemplate || selectedVouchers.length === 0) ? 0.6 : 1,
                width: '100%'
              }}
            >
{isGenerating ? 'PDF 생성 중...' : `📄 ${selectedVouchers.length}개 일괄 발행`}
            </button>
          </div>
        </div>
      </div>

      {/* 필터 섹션 */}
      <div style={{
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="일련번호"
            value={filters.serial_no}
            onChange={(e) => handleFilterChange('serial_no', e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'white'
            }}
          />
          <input
            type="text"
            placeholder="이름"
            value={filters.name}
            onChange={(e) => handleFilterChange('name', e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'white'
            }}
          />
          <input
            type="text"
            placeholder="영농회"
            value={filters.association}
            onChange={(e) => handleFilterChange('association', e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'white'
            }}
          />
          <input
            type="text"
            placeholder="조합원ID"
            value={filters.member_id}
            onChange={(e) => handleFilterChange('member_id', e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'white'
            }}
          />
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'white',
              color: '#374151'
            }}
          >
            <option value="">전체 상태</option>
            <option value="issuable">✅ 발행 가능 (등록됨 + 발행됨)</option>
            <option value="registered">등록됨 (신규 발행)</option>
            <option value="issued">발행됨 (재발행 가능)</option>
            <option value="used">사용됨 (발행 불가)</option>
            <option value="recalled">회수됨 (발행 불가)</option>
            <option value="disposed">폐기됨 (발행 불가)</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            검색
          </button>
          <button
            onClick={handleResetFilters}
            disabled={loading}
            style={{
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            초기화
          </button>
        </div>
      </div>

      {/* 교환권 목록 */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <div style={{
          backgroundColor: '#f9fafb',
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1a202c', margin: 0 }}>
            교환권 목록 ({pagination.total}개)
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              선택된 교환권: {selectedVouchers.length}개
            </div>
            {selectedVouchers.length > 0 && (
              <button
                onClick={handleBulkPrint}
                disabled={isGenerating || !selectedTemplate}
                style={{
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: (isGenerating || !selectedTemplate) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: (isGenerating || !selectedTemplate) ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isGenerating ? '생성 중...' : '🖨️ 일괄 인쇄'}
              </button>
            )}
          </div>
        </div>

        {/* 전체 선택 안내 */}
        {vouchers.length > 0 && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#f0f9ff',
            borderBottom: '1px solid #e5e7eb',
            fontSize: '14px',
            color: '#0369a1'
          }}>
            💡 "전체" 체크박스를 클릭하면 선택된 템플릿의 모든 교환권({pagination.total.toLocaleString()}개)을 선택합니다.
          </div>
        )}

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            데이터를 불러오는 중...
          </div>
        ) : vouchers.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            발행할 교환권이 없습니다.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb', width: '80px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>전체</span>
                    </div>
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    일련번호
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    영농회
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    조합원ID
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    이름
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    금액
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    상태
                  </th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((voucher) => (
                  <tr key={voucher.id}>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedVouchers.includes(voucher.id)}
                        onChange={() => handleSelectVoucher(voucher.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontFamily: 'monospace', fontSize: '13px' }}>
                      {voucher.serial_no}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                      {voucher.association}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                      {voucher.member_id}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: '500' }}>
                      {voucher.name}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontWeight: '600' }}>
                      {voucher.amount.toLocaleString()}원
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: 
                          voucher.status === 'registered' ? '#dbeafe' :
                          voucher.status === 'issued' ? '#dcfce7' : 
                          voucher.status === 'used' ? '#fef3c7' : 
                          voucher.status === 'recalled' ? '#fee2e2' :
                          voucher.status === 'disposed' ? '#fecaca' : '#f3f4f6',
                        color: 
                          voucher.status === 'registered' ? '#2563eb' :
                          voucher.status === 'issued' ? '#16a34a' : 
                          voucher.status === 'used' ? '#d97706' : 
                          voucher.status === 'recalled' ? '#dc2626' :
                          voucher.status === 'disposed' ? '#991b1b' : '#6b7280'
                      }}>
                        {voucher.status === 'registered' ? '📋 등록됨 (신규 발행)' :
                         voucher.status === 'issued' ? '✅ 발행됨 (재발행 가능)' : 
                         voucher.status === 'used' ? '❌ 사용됨' : 
                         voucher.status === 'recalled' ? '❌ 회수됨' :
                         voucher.status === 'disposed' ? '❌ 폐기됨' : '알 수 없음'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 페이징 */}
        {pagination.totalPages > 1 && (
          <div style={{
            padding: '16px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px'
          }}>
            <button
              onClick={() => fetchVouchers(pagination.page - 1)}
              disabled={!pagination.hasPrev || loading}
              style={{
                padding: '8px 12px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                cursor: (!pagination.hasPrev || loading) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: (!pagination.hasPrev || loading) ? 0.6 : 1
              }}
            >
              이전
            </button>
            
            <span style={{ fontSize: '14px', color: '#6b7280', margin: '0 16px' }}>
              {pagination.page} / {pagination.totalPages}
            </span>
            
            <button
              onClick={() => fetchVouchers(pagination.page + 1)}
              disabled={!pagination.hasNext || loading}
              style={{
                padding: '8px 12px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                cursor: (!pagination.hasNext || loading) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: (!pagination.hasNext || loading) ? 0.6 : 1
              }}
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}