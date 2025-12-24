'use client';

import React, { useState, useEffect } from 'react';

interface CollectionResult {
  serial_no: string;
  success: boolean;
  message: string;
  current_status?: string;
  previous_status?: string;
  collected_at?: string;
}

interface VoucherTemplate {
  id: string;
  voucher_name: string;
  voucher_type: string;
  status: string;
}

interface VoucherData {
  id: string;
  serial_no: string;
  amount: number;
  association: string;
  member_id: string;
  name: string;
  status: string;
  issued_at: string;
  template_id?: string;
  voucher_templates?: {
    voucher_name: string;
    voucher_type: string;
  };
}

export function VoucherRetrieveForm() {
  const [singleSerialNo, setSingleSerialNo] = useState('');
  const [bulkSerialNos, setBulkSerialNos] = useState('');
  const [reason, setReason] = useState('사용기간 만료');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<CollectionResult[]>([]);
  const [activeTab, setActiveTab] = useState<'template' | 'single' | 'bulk'>('template');
  
  // 새로운 상태들
  const [templates, setTemplates] = useState<VoucherTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [vouchers, setVouchers] = useState<VoucherData[]>([]);
  const [selectedVouchers, setSelectedVouchers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [unusedStats, setUnusedStats] = useState({ count: 0, amount: 0 });

  const handleSingleCollection = async () => {
    if (!singleSerialNo.trim()) {
      alert('일련번호를 입력해주세요.');
      return;
    }

    setIsProcessing(true);
    setResults([]);

    try {
      const response = await fetch('/api/vouchers/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          serial_no: singleSerialNo.trim(),
          reason: reason.trim(),
          notes: notes.trim()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setResults([{
          serial_no: singleSerialNo,
          success: true,
          message: data.message,
          collected_at: data.data?.collected_at,
          previous_status: data.data?.previous_status,
          current_status: data.data?.current_status
        }]);
        setSingleSerialNo('');
        setReason('');
        setNotes('');
      } else {
        setResults([{
          serial_no: singleSerialNo,
          success: false,
          message: data.message,
          current_status: data.current_status
        }]);
      }
    } catch (error) {
      console.error('교환권 회수 오류:', error);
      setResults([{
        serial_no: singleSerialNo,
        success: false,
        message: '서버 오류가 발생했습니다.'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // 템플릿 조회
  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/voucher-templates');
      const result = await response.json();
      console.log('템플릿 API 응답:', result);
      if (result.success) {
        console.log('템플릿 데이터:', result.data);
        setTemplates(result.data || []);
      }
    } catch (error) {
      console.error('템플릿 조회 오류:', error);
    }
  };

  // 교환권 조회
  const fetchVouchers = async () => {
    if (!selectedTemplate) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        template_id: selectedTemplate,
        status: 'issued', // 발행된 상태만
        limit: '1000'
      });
      
      const response = await fetch(`/api/vouchers?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        const voucherData = result.data || [];
        // 미사용 교환권 필터링 (issued 상태)
        const unusedVouchers = voucherData.filter(v => v.status === 'issued');
        setVouchers(unusedVouchers);
        
        // 미사용 통계 계산
        const stats = {
          count: unusedVouchers.length,
          amount: unusedVouchers.reduce((sum, v) => sum + v.amount, 0)
        };
        setUnusedStats(stats);
      }
    } catch (error) {
      console.error('교환권 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 개별 선택 회수
  const handleSelectedRecall = async () => {
    if (selectedVouchers.length === 0) {
      alert('회수할 교환권을 선택해주세요.');
      return;
    }

    setIsProcessing(true);
    setResults([]);

    try {
      const response = await fetch('/api/vouchers/bulk-collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          voucher_ids: selectedVouchers,
          reason: reason.trim() || '관리자 회수',
          notes: notes.trim()
        })
      });

      const data = await response.json();
      
      if (data.results) {
        setResults(data.results);
        if (data.success) {
          setSelectedVouchers([]);
          setReason('사용기간 만료');
          setNotes('');
          // 목록 새로고침
          fetchVouchers();
        }
      }
    } catch (error) {
      console.error('선택 회수 오류:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // 미사용 일괄 회수
  const handleBulkUnusedRecall = async () => {
    if (unusedStats.count === 0) {
      alert('회수할 미사용 교환권이 없습니다.');
      return;
    }

    if (!confirm(`미사용 교환권 ${unusedStats.count}건을 모두 회수하시겠습니까?`)) {
      return;
    }

    setIsProcessing(true);
    setResults([]);

    try {
      const unusedIds = vouchers.filter(v => v.status === 'issued').map(v => v.id);
      
      const response = await fetch('/api/vouchers/bulk-collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          voucher_ids: unusedIds,
          reason: reason.trim() || '미사용 일괄 회수',
          notes: notes.trim()
        })
      });

      const data = await response.json();
      
      if (data.results) {
        setResults(data.results);
        if (data.success) {
          setReason('사용기간 만료');
          setNotes('');
          // 목록 새로고침
          fetchVouchers();
        }
      }
    } catch (error) {
      console.error('일괄 회수 오류:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkCollection = async () => {
    const serialNumbers = bulkSerialNos
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (serialNumbers.length === 0) {
      alert('회수할 일련번호를 입력해주세요.');
      return;
    }

    setIsProcessing(true);
    setResults([]);

    try {
      const response = await fetch('/api/vouchers/bulk-collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          serial_numbers: serialNumbers,
          reason: reason.trim(),
          notes: notes.trim()
        })
      });

      const data = await response.json();
      
      if (data.results) {
        setResults(data.results);
        if (data.success) {
          setBulkSerialNos('');
          setReason('사용기간 만료');
          setNotes('');
        }
      } else {
        setResults([{
          serial_no: 'bulk_operation',
          success: false,
          message: data.message || '일괄 회수에 실패했습니다.'
        }]);
      }
    } catch (error) {
      console.error('일괄 교환권 회수 오류:', error);
      setResults([{
        serial_no: 'bulk_operation',
        success: false,
        message: '서버 오류가 발생했습니다.'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // 초기 데이터 로드
  useEffect(() => {
    fetchTemplates();
  }, []);

  // 템플릿 변경 시 교환권 조회
  useEffect(() => {
    if (selectedTemplate) {
      fetchVouchers();
    }
  }, [selectedTemplate]);

  return (
    <div>
      <h3 style={{
        fontSize: '20px',
        fontWeight: '600',
        color: '#1a202c',
        marginBottom: '16px'
      }}>
        교환권 회수 (관리자 전용)
      </h3>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>
        발행된 교환권을 시스템에서 회수합니다. 회수된 교환권은 더 이상 사용할 수 없습니다.
      </p>

      {/* 탭 메뉴 */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <button
          onClick={() => setActiveTab('template')}
          style={{
            padding: '12px 20px',
            backgroundColor: 'transparent',
            color: activeTab === 'template' ? '#3b82f6' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'template' ? '2px solid #3b82f6' : '2px solid transparent',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          템플릿별 회수
        </button>
        <button
          onClick={() => setActiveTab('single')}
          style={{
            padding: '12px 20px',
            backgroundColor: 'transparent',
            color: activeTab === 'single' ? '#3b82f6' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'single' ? '2px solid #3b82f6' : '2px solid transparent',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          개별 회수
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
          일괄 회수
        </button>
      </div>

      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '24px'
      }}>
        {activeTab === 'template' ? (
          <div>
            <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              템플릿별 교환권 회수
            </h4>
            
            {/* 템플릿 선택 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                교환권 템플릿 선택 *
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => {
                  setSelectedTemplate(e.target.value);
                  setVouchers([]);
                  setSelectedVouchers([]);
                  setUnusedStats({ count: 0, amount: 0 });
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: 'white',
                  color: '#374151'
                }}
              >
                <option value="">템플릿을 선택하세요</option>
                {(() => {
                  console.log('렌더링 시점 templates 상태:', templates);
                  console.log('templates 길이:', templates.length);
                  return templates.map((template) => {
                    console.log('템플릿 항목:', template);
                    return (
                      <option key={template.id} value={template.id}>
                        {template.voucher_name} ({template.voucher_type})
                      </option>
                    );
                  });
                })()}
              </select>
            </div>

            {/* 조회 버튼 */}
            {selectedTemplate && (
              <div style={{ marginBottom: '16px' }}>
                <button
                  onClick={fetchVouchers}
                  disabled={loading}
                  style={{
                    backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? '조회 중...' : '🔍 미사용 교환권 조회'}
                </button>
              </div>
            )}

            {/* 미사용 통계 */}
            {unusedStats.count > 0 && (
              <div style={{
                backgroundColor: '#f0f9ff',
                border: '1px solid #dbeafe',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <h5 style={{ margin: '0 0 8px 0', color: '#1e40af' }}>📊 미사용 교환권 현황</h5>
                <div style={{ display: 'flex', gap: '24px' }}>
                  <div>
                    <span style={{ fontSize: '14px', color: '#64748b' }}>수량: </span>
                    <strong style={{ fontSize: '16px', color: '#1e40af' }}>{unusedStats.count.toLocaleString()}건</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '14px', color: '#64748b' }}>금액: </span>
                    <strong style={{ fontSize: '16px', color: '#1e40af' }}>{unusedStats.amount.toLocaleString()}원</strong>
                  </div>
                </div>
              </div>
            )}

            {/* 교환권 목록 */}
            {vouchers.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h5 style={{ margin: 0 }}>미사용 교환권 목록</h5>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        if (selectedVouchers.length === vouchers.length) {
                          setSelectedVouchers([]);
                        } else {
                          setSelectedVouchers(vouchers.map(v => v.id));
                        }
                      }}
                      style={{
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      {selectedVouchers.length === vouchers.length ? '전체 해제' : '전체 선택'}
                    </button>
                    <span style={{ fontSize: '12px', color: '#6b7280', alignSelf: 'center' }}>
                      {selectedVouchers.length}/{vouchers.length}개 선택
                    </span>
                  </div>
                </div>
                
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', width: '40px' }}>선택</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>일련번호</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>이름</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>영농회</th>
                        <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>금액</th>
                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>발행일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vouchers.map((voucher) => (
                        <tr key={voucher.id} style={{ backgroundColor: selectedVouchers.includes(voucher.id) ? '#eff6ff' : 'white' }}>
                          <td style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                            <input
                              type="checkbox"
                              checked={selectedVouchers.includes(voucher.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedVouchers([...selectedVouchers, voucher.id]);
                                } else {
                                  setSelectedVouchers(selectedVouchers.filter(id => id !== voucher.id));
                                }
                              }}
                            />
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace', fontSize: '12px' }}>
                            {voucher.serial_no}
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #f3f4f6', fontSize: '14px', fontWeight: '500' }}>
                            {voucher.name}
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #f3f4f6', fontSize: '14px', color: '#6b7280' }}>
                            {voucher.association}
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #f3f4f6', fontSize: '14px', fontWeight: '500', textAlign: 'right' }}>
                            {voucher.amount.toLocaleString()}원
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #f3f4f6', fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
                            {new Date(voucher.issued_at).toLocaleDateString('ko-KR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'single' ? (
          <div>
            <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              개별 교환권 회수
            </h4>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                일련번호 *
              </label>
              <input
                type="text"
                value={singleSerialNo}
                onChange={(e) => setSingleSerialNo(e.target.value)}
                placeholder="교환권 일련번호를 입력하세요"
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
        ) : (
          <div>
            <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              일괄 교환권 회수
            </h4>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                일련번호 목록 (한 줄에 하나씩) *
              </label>
              <textarea
                value={bulkSerialNos}
                onChange={(e) => setBulkSerialNos(e.target.value)}
                placeholder={`교환권 일련번호를 한 줄에 하나씩 입력하세요:\nVCH:12345|TS:202412131200|SIG:abc123\nVCH:12346|TS:202412131201|SIG:def456\n...`}
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

        {/* 공통 필드 */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
            회수 사유
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 만료, 오발급, 고객 요청 등"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '16px'
            }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
            참고사항
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

        {activeTab === 'template' ? (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleSelectedRecall}
              disabled={isProcessing || selectedVouchers.length === 0}
              style={{
                backgroundColor: isProcessing || selectedVouchers.length === 0 ? '#9ca3af' : '#dc2626',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isProcessing || selectedVouchers.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>🔄</span>
              선택한 교환권 회수 ({selectedVouchers.length}건)
            </button>
            
            <button
              onClick={handleBulkUnusedRecall}
              disabled={isProcessing || unusedStats.count === 0}
              style={{
                backgroundColor: isProcessing || unusedStats.count === 0 ? '#9ca3af' : '#ef4444',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isProcessing || unusedStats.count === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>⚠️</span>
              미사용 전체 회수 ({unusedStats.count}건)
            </button>
          </div>
        ) : (
          <button
            onClick={activeTab === 'single' ? handleSingleCollection : handleBulkCollection}
            disabled={isProcessing}
            style={{
              backgroundColor: isProcessing ? '#9ca3af' : '#dc2626',
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
                <span>🔄</span>
                {activeTab === 'single' ? '교환권 회수' : '일괄 회수'}
              </>
            )}
          </button>
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
                  backgroundColor: result.success ? '#f0f9ff' : '#fef2f2',
                  border: `1px solid ${result.success ? '#dbeafe' : '#fecaca'}`,
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
                  {result.collected_at && (
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      ({new Date(result.collected_at).toLocaleString()})
                    </span>
                  )}
                </div>
                <p style={{
                  margin: 0,
                  color: result.success ? '#065f46' : '#dc2626',
                  fontSize: '14px'
                }}>
                  {result.message}
                </p>
                {result.current_status && (
                  <p style={{
                    margin: '4px 0 0 0',
                    color: '#6b7280',
                    fontSize: '12px'
                  }}>
                    현재 상태: {result.current_status}
                    {result.previous_status && ` (이전: ${result.previous_status})`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}