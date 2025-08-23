'use client';

import React, { useState, useEffect } from 'react';
import { formatPhoneForDisplay, formatPhoneInput, cleanPhoneInput } from '@/lib/phone-utils';

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
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function VoucherRecipientsForm() {
  const [templates, setTemplates] = useState<VoucherTemplate[]>([]);
  const [recipients, setRecipients] = useState<VoucherRecipient[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [showIndividualForm, setShowIndividualForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<VoucherRecipient | null>(null);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
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
    status: ''
  });

  // 선택된 교환권들 (대량 삭제용)
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // 집계 데이터
  const [summary, setSummary] = useState({
    totalCount: 0,
    totalAmount: 0,
    filteredCount: 0,
    filteredAmount: 0
  });
  
  const [formData, setFormData] = useState({
    serial_no: '',
    amount: '',
    association: '',
    member_id: '',
    name: '',
    dob: '',
    phone: '',
    notes: ''
  });

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);

  // 교환권 템플릿 목록 조회
  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/voucher-templates');
      const result = await response.json();
      
      if (result.success) {
        setTemplates(result.data.filter((t: VoucherTemplate) => t.status === 'active'));
      }
    } catch (error) {
      console.error('템플릿 조회 오류:', error);
    }
  };

  // 전체 합계 조회 (템플릿별)
  const fetchTotalSummary = async () => {
    if (!selectedTemplate) return;
    
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '999999',
        template_id: selectedTemplate
      });
      
      const response = await fetch(`/api/vouchers?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        const allData = result.data || [];
        const totalCount = allData.length;
        const totalAmount = allData.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
        
        setSummary(prev => ({
          ...prev,
          totalCount,
          totalAmount
        }));
      }
    } catch (error) {
      console.error('전체 합계 조회 오류:', error);
    }
  };

  // 필터된 전체 합계 조회
  const fetchFilteredTotal = async () => {
    if (!selectedTemplate) return;
    
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '999999'
      });

      // 템플릿 ID 필터 추가 (필수)
      if (selectedTemplate) {
        params.append('template_id', selectedTemplate);
      }

      // 필터 추가
      if (filters.serial_no) params.append('serial_no', filters.serial_no);
      if (filters.name) params.append('name', filters.name);
      if (filters.association) params.append('association', filters.association);
      if (filters.member_id) params.append('member_id', filters.member_id);
      if (filters.status) params.append('status', filters.status);

      const response = await fetch(`/api/vouchers?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        const allFilteredData = result.data || [];
        const filteredCount = allFilteredData.length;
        const filteredAmount = allFilteredData.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
        
        setSummary(prev => ({
          ...prev,
          filteredCount,
          filteredAmount
        }));
      }
    } catch (error) {
      console.error('필터된 합계 조회 오류:', error);
    }
  };

  // 발행 대상자 목록 조회
  const fetchRecipients = async (page = pagination.page) => {
    if (!selectedTemplate) {
      console.log('템플릿이 선택되지 않았습니다.');
      setRecipients([]);
      return;
    }
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      });

      // 템플릿 ID 필터 추가 (필수)
      if (selectedTemplate) {
        params.append('template_id', selectedTemplate);
      }

      // 필터 추가
      if (filters.serial_no) params.append('serial_no', filters.serial_no);
      if (filters.name) params.append('name', filters.name);
      if (filters.association) params.append('association', filters.association);
      if (filters.member_id) params.append('member_id', filters.member_id);
      if (filters.status) params.append('status', filters.status);

      const response = await fetch(`/api/vouchers?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setRecipients(result.data || []);
        setPagination(result.pagination || pagination);
        setSelectedRecipients([]); // 새 조회 시 선택 초기화
        setSelectAll(false);
        
        // 필터된 전체 금액 합계 별도 계산
        fetchFilteredTotal();
      } else {
        setMessage({ type: 'error', text: result.message || '발행 대상자 조회에 실패했습니다.' });
      }
    } catch (error) {
      console.error('발행 대상자 조회 오류:', error);
      setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 일련번호 자동 생성
  const generateSerialNumber = () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(2,10).replace(/-/g,''); // YYMMDD
    const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const checkDigit = Math.floor(Math.random() * 10);
    return `${dateStr}${randomNum}${checkDigit}`;
  };

  // 개별 등록
  const handleIndividualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTemplate) {
      setMessage({ type: 'error', text: '교환권 템플릿을 선택해주세요.' });
      return;
    }

    // 필수 필드 검증
    if (!formData.amount || !formData.association || !formData.member_id || !formData.name || !formData.dob) {
      setMessage({ type: 'error', text: '모든 필수 필드를 입력해주세요.' });
      return;
    }

    setLoading(true);
    try {
      const submitData = {
        template_id: selectedTemplate,
        serial_no: formData.serial_no || generateSerialNumber(),
        amount: parseInt(formData.amount),
        association: formData.association,
        member_id: formData.member_id,
        name: formData.name,
        dob: formData.dob,
        phone: formData.phone,
        notes: formData.notes
      };

      const response = await fetch('/api/vouchers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: 'success', text: '발행 대상자가 등록되었습니다.' });
        setShowIndividualForm(false);
        setFormData({
          serial_no: '',
          amount: '',
          association: '',
          member_id: '',
          name: '',
          dob: '',
          phone: '',
          notes: ''
        });
        fetchRecipients();
      } else {
        setMessage({ type: 'error', text: result.message || '등록에 실패했습니다.' });
      }
    } catch (error) {
      console.error('개별 등록 오류:', error);
      setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // CSV 파일 처리
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        setMessage({ type: 'error', text: 'CSV 파일에 데이터가 없습니다.' });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const preview = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });

      setCsvPreview(preview);
    };
    
    reader.readAsText(file, 'utf-8');
  };

  // CSV 대량 등록
  const handleBulkUpload = async () => {
    if (!csvFile) {
      setMessage({ type: 'error', text: '파일을 선택해주세요.' });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('template_id', selectedTemplate);

      const response = await fetch('/api/vouchers/bulk-issue', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: `${result.data?.count || 0}명의 발행 대상자가 등록되었습니다.` 
        });
        setShowBulkUpload(false);
        setCsvFile(null);
        setCsvPreview([]);
        fetchRecipients(1); // 첫 페이지로 이동
      } else {
        setMessage({ type: 'error', text: result.message || '대량 등록에 실패했습니다.' });
      }
    } catch (error) {
      console.error('대량 등록 오류:', error);
      setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 교환권 수정
  const handleEdit = (recipient: VoucherRecipient) => {
    setEditingRecipient(recipient);
    setFormData({
      serial_no: recipient.serial_no,
      amount: recipient.amount.toString(),
      association: recipient.association,
      member_id: recipient.member_id,
      name: recipient.name,
      dob: recipient.dob,
      phone: recipient.phone || '',
      notes: recipient.notes || ''
    });
    setShowEditForm(true);
  };

  // 교환권 수정 제출
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingRecipient) return;

    // 필수 필드 검증
    if (!formData.amount || !formData.association || !formData.member_id || !formData.name || !formData.dob) {
      setMessage({ type: 'error', text: '모든 필수 필드를 입력해주세요.' });
      return;
    }

    setLoading(true);
    try {
      const submitData = {
        serial_no: formData.serial_no || undefined,
        amount: parseInt(formData.amount),
        association: formData.association,
        member_id: formData.member_id,
        name: formData.name,
        dob: formData.dob,
        phone: formData.phone,
        notes: formData.notes
      };

      const response = await fetch(`/api/vouchers/${editingRecipient.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: 'success', text: '교환권이 수정되었습니다.' });
        setShowEditForm(false);
        setEditingRecipient(null);
        setFormData({
          serial_no: '',
          amount: '',
          association: '',
          member_id: '',
          name: '',
          dob: '',
          phone: '',
          notes: ''
        });
        fetchRecipients();
      } else {
        setMessage({ type: 'error', text: result.message || '수정에 실패했습니다.' });
      }
    } catch (error) {
      console.error('교환권 수정 오류:', error);
      setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 교환권 삭제
  const handleDelete = async (recipient: VoucherRecipient) => {
    if (!confirm(`"${recipient.serial_no}" 교환권을 정말 삭제하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/vouchers/${recipient.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: 'success', text: '교환권이 삭제되었습니다.' });
        fetchRecipients();
      } else {
        setMessage({ type: 'error', text: result.message || '삭제에 실패했습니다.' });
      }
    } catch (error) {
      console.error('교환권 삭제 오류:', error);
      setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 대량 삭제
  const handleBulkDelete = async () => {
    if (selectedRecipients.length === 0) {
      setMessage({ type: 'error', text: '삭제할 교환권을 선택해주세요.' });
      return;
    }

    if (!confirm(`선택된 ${selectedRecipients.length}개의 교환권을 정말 삭제하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/vouchers/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voucher_ids: selectedRecipients
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        setSelectedRecipients([]);
        setSelectAll(false);
        fetchRecipients();
      } else {
        setMessage({ type: 'error', text: result.message || '대량 삭제에 실패했습니다.' });
      }
    } catch (error) {
      console.error('대량 삭제 오류:', error);
      setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRecipients([]);
    } else {
      setSelectedRecipients(recipients.map(r => r.id));
    }
    setSelectAll(!selectAll);
  };

  // 개별 선택/해제
  const handleSelectRecipient = (id: string) => {
    if (selectedRecipients.includes(id)) {
      setSelectedRecipients(selectedRecipients.filter(rid => rid !== id));
      setSelectAll(false);
    } else {
      const newSelected = [...selectedRecipients, id];
      setSelectedRecipients(newSelected);
      setSelectAll(newSelected.length === recipients.length);
    }
  };

  // 필터 적용
  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 })); // 첫 페이지로 이동
    fetchRecipients(1);
  };

  // 필터 초기화
  const handleFilterReset = () => {
    setFilters({
      serial_no: '',
      name: '',
      association: '',
      member_id: '',
      status: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
    // 빈 필터로 다시 조회
    setTimeout(() => fetchRecipients(1), 0);
  };

  // 페이지 변경
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchRecipients(newPage);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      fetchRecipients();
      fetchTotalSummary();
    } else {
      // 템플릿이 선택되지 않았을 때 초기화
      setRecipients([]);
      setSummary({
        totalCount: 0,
        totalAmount: 0,
        filteredCount: 0,
        filteredAmount: 0
      });
    }
  }, [selectedTemplate]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // 필터 변경 시 첫 페이지로 이동하며 재조회
  useEffect(() => {
    if (selectedTemplate) {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchRecipients(1);
    }
  }, [filters]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1a202c',
            marginBottom: '8px'
          }}>
            발행대상 등록
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '0' }}>
            교환권을 발행할 대상자를 등록하고 관리합니다.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowBulkUpload(true)}
            disabled={loading}
            style={{
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: loading ? 0.6 : 1
            }}
          >
            📄 CSV 대량등록
          </button>
          <button
            onClick={() => setShowIndividualForm(true)}
            disabled={loading}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: loading ? 0.6 : 1
            }}
          >
            + 개별 등록
          </button>
        </div>
      </div>

      {/* 템플릿 선택 */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
          교환권 템플릿 선택
        </label>
        <select
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          style={{
            width: '300px',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            boxSizing: 'border-box',
            color: '#374151'
          }}
        >
          <option value="">템플릿을 선택하세요</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.voucher_name} ({template.voucher_type})
            </option>
          ))}
        </select>
      </div>

      {/* 메시지 표시 */}
      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '6px',
          marginBottom: '16px',
          backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: message.type === 'success' ? '#16a34a' : '#dc2626',
          border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`
        }}>
          {message.text}
        </div>
      )}

      {/* 개별 등록 폼 */}
      {showIndividualForm && (
        <div style={{
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1a202c', margin: 0 }}>
              개별 등록
            </h4>
            <button
              onClick={() => setShowIndividualForm(false)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '0'
              }}
            >
              ×
            </button>
          </div>

          <form onSubmit={handleIndividualSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  일련번호 (공란시 자동생성)
                </label>
                <input
                  type="text"
                  value={formData.serial_no}
                  onChange={(e) => setFormData(prev => ({ ...prev, serial_no: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="자동생성됩니다"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  금액 *
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="50000"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  영농회 *
                </label>
                <input
                  type="text"
                  value={formData.association}
                  onChange={(e) => setFormData(prev => ({ ...prev, association: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="예: 성주사과농협"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  조합원ID *
                </label>
                <input
                  type="text"
                  value={formData.member_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, member_id: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="예: 12345"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  이름 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="홍길동"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  생년월일 *
                </label>
                <input
                  type="date"
                  value={formData.dob}
                  onChange={(e) => setFormData(prev => ({ ...prev, dob: e.target.value }))}
                  required
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
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                전화번호
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
                placeholder="010-1234-5678"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                비고
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
                placeholder="추가 정보가 있으면 입력하세요"
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowIndividualForm(false)}
                disabled={loading}
                style={{
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: loading ? 0.6 : 1
                }}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? '등록중...' : '등록'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CSV 대량 등록 폼 */}
      {showBulkUpload && (
        <div style={{
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1a202c', margin: 0 }}>
              CSV 대량 등록
            </h4>
            <button
              onClick={() => {
                setShowBulkUpload(false);
                setCsvFile(null);
                setCsvPreview([]);
              }}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '0'
              }}
            >
              ×
            </button>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                  CSV 파일 형식: serial_no,amount,association,member_id,name,dob,phone,notes
                </p>
                <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                  ※ serial_no가 공란이면 자동 생성됩니다. phone, notes는 선택사항입니다.
                </p>
              </div>
              <a 
                href="/api/vouchers/csv-template"
                download="voucher-template.csv"
                style={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: '500'
                }}
              >
                📄 예시파일 다운로드
              </a>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            />
          </div>

          {csvPreview.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                미리보기 (최대 5줄)
              </h5>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                      {Object.keys(csvPreview[0]).map(key => (
                        <th key={key} style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((row, index) => (
                      <tr key={index}>
                        {Object.values(row).map((value: any, i) => (
                          <td key={i} style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>
                            {value || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setShowBulkUpload(false);
                setCsvFile(null);
                setCsvPreview([]);
              }}
              disabled={loading}
              style={{
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: loading ? 0.6 : 1
              }}
            >
              취소
            </button>
            <button
              onClick={handleBulkUpload}
              disabled={loading || !csvFile}
              style={{
                backgroundColor: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: (loading || !csvFile) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: (loading || !csvFile) ? 0.6 : 1
              }}
            >
              {loading ? '업로드중...' : '대량 등록'}
            </button>
          </div>
        </div>
      )}

      {/* 필터 폼 */}
      {selectedTemplate && (
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1a202c', margin: 0 }}>
              교환권 검색 및 필터
            </h4>
            <button
              onClick={handleFilterReset}
              disabled={loading}
              style={{
                backgroundColor: '#64748b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 12px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                opacity: loading ? 0.6 : 1
              }}
            >
              초기화
            </button>
          </div>

          <form onSubmit={handleFilterSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  일련번호
                </label>
                <input
                  type="text"
                  value={filters.serial_no}
                  onChange={(e) => setFilters(prev => ({ ...prev, serial_no: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="일련번호 검색"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  이름
                </label>
                <input
                  type="text"
                  value={filters.name}
                  onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="이름 검색"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  영농회
                </label>
                <input
                  type="text"
                  value={filters.association}
                  onChange={(e) => setFilters(prev => ({ ...prev, association: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="영농회/조합 검색"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  조합원ID
                </label>
                <input
                  type="text"
                  value={filters.member_id}
                  onChange={(e) => setFilters(prev => ({ ...prev, member_id: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="조합원ID 검색"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  상태
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    color: '#374151'
                  }}
                >
                  <option value="">전체</option>
                  <option value="registered">등록됨</option>
                  <option value="issued">발행됨</option>
                  <option value="used">사용됨</option>
                  <option value="recalled">회수됨</option>
                  <option value="disposed">폐기됨</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 16px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  opacity: loading ? 0.6 : 1
                }}
              >
                🔍 검색
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 발행 대상자 목록 */}
      {selectedTemplate && (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <div style={{
            backgroundColor: '#f9fafb',
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1a202c', margin: 0 }}>
                발행 대상자 목록
              </h4>
              
              {selectedRecipients.length > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={loading}
                  style={{
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: '500',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  🗑️ 선택삭제 ({selectedRecipients.length})
                </button>
              )}
            </div>
            
            {/* 집계 정보 */}
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#6b7280' }}>
              <div style={{ backgroundColor: '#ffffff', padding: '6px 12px', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                <span style={{ fontWeight: '500', color: '#374151' }}>전체:</span> {summary.totalCount.toLocaleString()}건 / {summary.totalAmount.toLocaleString()}원
              </div>
              {(filters.serial_no || filters.name || filters.association || filters.member_id || filters.status) && (
                <div style={{ backgroundColor: '#dbeafe', padding: '6px 12px', borderRadius: '4px', border: '1px solid #93c5fd' }}>
                  <span style={{ fontWeight: '500', color: '#1e40af' }}>필터 결과:</span> {summary.filteredCount.toLocaleString()}건 / {summary.filteredAmount.toLocaleString()}원
                </div>
              )}
              <div style={{ backgroundColor: '#f3f4f6', padding: '6px 12px', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                <span style={{ fontWeight: '500', color: '#374151' }}>현재 페이지:</span> {recipients.length}건
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              데이터를 불러오는 중...
            </div>
          ) : recipients.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              등록된 발행 대상자가 없습니다.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb', width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        style={{ margin: 0 }}
                      />
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                      일련번호
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                      이름
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                      영농회
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                      조합원ID
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                      금액
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                      생년월일
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                      상태
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                      등록일
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb', width: '120px' }}>
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((recipient) => (
                    <tr key={recipient.id}>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedRecipients.includes(recipient.id)}
                          onChange={() => handleSelectRecipient(recipient.id)}
                          style={{ margin: 0 }}
                        />
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontFamily: 'monospace' }}>
                        {recipient.serial_no}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: '500' }}>
                        {recipient.name}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                        {recipient.association}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', fontWeight: '500', color: '#1f2937' }}>
                        {recipient.member_id}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontWeight: '500' }}>
                        {recipient.amount.toLocaleString()}원
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                        {recipient.dob}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: 
                            recipient.status === 'registered' ? '#f3f4f6' :
                            recipient.status === 'issued' ? '#dcfce7' : 
                            recipient.status === 'used' ? '#fef3c7' :
                            recipient.status === 'recalled' ? '#dbeafe' :
                            recipient.status === 'disposed' ? '#fee2e2' : '#f3f4f6',
                          color: 
                            recipient.status === 'registered' ? '#6b7280' :
                            recipient.status === 'issued' ? '#16a34a' : 
                            recipient.status === 'used' ? '#d97706' :
                            recipient.status === 'recalled' ? '#2563eb' :
                            recipient.status === 'disposed' ? '#dc2626' : '#6b7280'
                        }}>
                          {recipient.status === 'registered' ? '등록됨' :
                           recipient.status === 'issued' ? '발행됨' : 
                           recipient.status === 'used' ? '사용됨' :
                           recipient.status === 'recalled' ? '회수됨' :
                           recipient.status === 'disposed' ? '폐기됨' : '알 수 없음'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontSize: '12px' }}>
                        {new Date(recipient.issued_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleEdit(recipient)}
                            disabled={loading || ['used', 'disposed'].includes(recipient.status)}
                            style={{
                              backgroundColor: ['used', 'disposed'].includes(recipient.status) ? '#f3f4f6' : '#3b82f6',
                              color: ['used', 'disposed'].includes(recipient.status) ? '#9ca3af' : 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              cursor: (loading || ['used', 'disposed'].includes(recipient.status)) ? 'not-allowed' : 'pointer',
                              fontSize: '11px',
                              fontWeight: '500',
                              opacity: (loading || ['used', 'disposed'].includes(recipient.status)) ? 0.6 : 1
                            }}
                            title={['used', 'disposed'].includes(recipient.status) ? '사용되거나 폐기된 교환권은 수정할 수 없습니다' : '수정'}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(recipient)}
                            disabled={loading || ['used', 'disposed'].includes(recipient.status)}
                            style={{
                              backgroundColor: ['used', 'disposed'].includes(recipient.status) ? '#f3f4f6' : '#dc2626',
                              color: ['used', 'disposed'].includes(recipient.status) ? '#9ca3af' : 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              cursor: (loading || ['used', 'disposed'].includes(recipient.status)) ? 'not-allowed' : 'pointer',
                              fontSize: '11px',
                              fontWeight: '500',
                              opacity: (loading || ['used', 'disposed'].includes(recipient.status)) ? 0.6 : 1
                            }}
                            title={['used', 'disposed'].includes(recipient.status) ? '사용되거나 폐기된 교환권은 삭제할 수 없습니다' : '삭제'}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 페이지네이션 */}
          {!loading && recipients.length > 0 && pagination.totalPages > 1 && (
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '12px 16px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                {pagination.page} / {pagination.totalPages} 페이지 (총 {pagination.total}건)
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={!pagination.hasPrev}
                  style={{
                    backgroundColor: pagination.hasPrev ? '#f3f4f6' : '#f9fafb',
                    color: pagination.hasPrev ? '#374151' : '#9ca3af',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    padding: '6px 8px',
                    cursor: pagination.hasPrev ? 'pointer' : 'not-allowed',
                    fontSize: '12px'
                  }}
                >
                  ⏮️
                </button>
                
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                  style={{
                    backgroundColor: pagination.hasPrev ? '#f3f4f6' : '#f9fafb',
                    color: pagination.hasPrev ? '#374151' : '#9ca3af',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    cursor: pagination.hasPrev ? 'pointer' : 'not-allowed',
                    fontSize: '12px'
                  }}
                >
                  ⬅️ 이전
                </button>

                {/* 페이지 번호 표시 */}
                {Array.from(
                  { length: Math.min(5, pagination.totalPages) },
                  (_, i) => {
                    const start = Math.max(1, pagination.page - 2);
                    const pageNum = start + i;
                    if (pageNum > pagination.totalPages) return null;
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        style={{
                          backgroundColor: pageNum === pagination.page ? '#3b82f6' : '#f3f4f6',
                          color: pageNum === pagination.page ? 'white' : '#374151',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          padding: '6px 10px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: pageNum === pagination.page ? '600' : '400'
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                )}

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                  style={{
                    backgroundColor: pagination.hasNext ? '#f3f4f6' : '#f9fafb',
                    color: pagination.hasNext ? '#374151' : '#9ca3af',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    cursor: pagination.hasNext ? 'pointer' : 'not-allowed',
                    fontSize: '12px'
                  }}
                >
                  다음 ➡️
                </button>
                
                <button
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={!pagination.hasNext}
                  style={{
                    backgroundColor: pagination.hasNext ? '#f3f4f6' : '#f9fafb',
                    color: pagination.hasNext ? '#374151' : '#9ca3af',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    padding: '6px 8px',
                    cursor: pagination.hasNext ? 'pointer' : 'not-allowed',
                    fontSize: '12px'
                  }}
                >
                  ⏭️
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 교환권 수정 폼 */}
      {showEditForm && editingRecipient && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ fontSize: '18px', fontWeight: '600', color: '#1a202c', margin: 0 }}>
                교환권 수정 - {editingRecipient.serial_no}
              </h4>
              <button
                onClick={() => {
                  setShowEditForm(false);
                  setEditingRecipient(null);
                  setFormData({
                    serial_no: '',
                    amount: '',
                    association: '',
                    member_id: '',
                    name: '',
                    dob: '',
                    phone: '',
                    notes: ''
                  });
                }}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  fontSize: '20px',
                  padding: '0'
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                    일련번호
                  </label>
                  <input
                    type="text"
                    value={formData.serial_no}
                    onChange={(e) => setFormData(prev => ({ ...prev, serial_no: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="일련번호"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                    금액 *
                  </label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="50000"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                    영농회 *
                  </label>
                  <input
                    type="text"
                    value={formData.association}
                    onChange={(e) => setFormData(prev => ({ ...prev, association: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="예: 성주사과농협"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                    조합원ID *
                  </label>
                  <input
                    type="text"
                    value={formData.member_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, member_id: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="예: 12345"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                    이름 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="홍길동"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                    생년월일 *
                  </label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData(prev => ({ ...prev, dob: e.target.value }))}
                    required
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
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                    전화번호
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="010-1234-5678"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  비고
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                  placeholder="추가 정보가 있으면 입력하세요"
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingRecipient(null);
                    setFormData({
                      serial_no: '',
                      amount: '',
                      association: '',
                      member_id: '',
                      name: '',
                      dob: '',
                      phone: '',
                      notes: ''
                    });
                  }}
                  disabled={loading}
                  style={{
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '10px 16px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '10px 16px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  {loading ? '수정중...' : '수정 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}