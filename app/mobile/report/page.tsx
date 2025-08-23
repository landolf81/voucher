'use client';

import React, { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { useAuth } from '@/lib/contexts/AuthContext';

interface TemplateInfo {
  id: string;
  voucher_name: string;
  voucher_type: string;
}

interface SiteInfo {
  id: string;
  site_name: string;
}

interface UsageReportData {
  summary: {
    totalCount: number;
    totalAmount: number;
    dateRange: { start: string | null; end: string | null };
  };
  byDate: Array<{
    date: string;
    count: number;
    amount: number;
  }>;
  byTemplate: Array<{
    template_id: string;
    template_name: string;
    template_type: string;
    count: number;
    amount: number;
  }>;
  vouchers: Array<{
    id: string;
    serial_no: string;
    amount: number;
    association: string;
    name: string;
    used_at: string;
    used_date: string;
    issued_at: string | null;
    template_info: {
      voucher_name: string;
      voucher_type: string;
    } | null;
    site_name: string | null;
  }>;
}

export default function MobileReportPage() {
  const { user } = useAuth();
  const [reportData, setReportData] = useState<UsageReportData | null>(null);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [sites, setSites] = useState<SiteInfo[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('all');
  const [selectedSite, setSelectedSite] = useState('auto'); // 'auto'는 사용자 소속 사업장 자동 선택
  const [loading, setLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  
  const isAdmin = user?.role === 'admin';

  // 기본 날짜 설정 (오늘)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
  }, []);

  // 템플릿 목록 조회
  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const response = await fetch('/api/voucher-templates');
      const result = await response.json();

      if (result.success) {
        setTemplates(result.data || []);
        console.log('템플릿 목록 조회 성공:', result.data);
      } else {
        console.error('템플릿 조회 오류:', result.error);
      }
    } catch (error) {
      console.error('템플릿 조회 중 오류:', error);
    } finally {
      setTemplatesLoading(false);
    }
  };

  // 사이트 목록 조회 (관리자만)
  const fetchSites = async () => {
    if (!isAdmin) return;

    setSitesLoading(true);
    try {
      const response = await fetch('/api/sites');
      const result = await response.json();

      if (result.success) {
        setSites(result.data || []);
      } else {
        console.error('사이트 조회 오류:', result.error);
      }
    } catch (error) {
      console.error('사이트 조회 중 오류:', error);
    } finally {
      setSitesLoading(false);
    }
  };

  // 리포트 데이터 조회
  const fetchReportData = async () => {
    if (!user?.id) {
      setError('로그인이 필요합니다.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        user_id: user.id,
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(selectedTemplate !== 'all' && { template_id: selectedTemplate }),
        ...(selectedSite !== 'auto' && { site_id: selectedSite })
      });

      const response = await fetch(`/api/v1/vouchers/usage-report?${params}`);
      const result = await response.json();

      if (result.success) {
        setReportData(result.data);
      } else {
        setError(result.error || '데이터 조회에 실패했습니다.');
      }
    } catch (error) {
      console.error('리포트 데이터 조회 오류:', error);
      setError('데이터 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 보고서 출력 (이미 조회된 데이터 사용)
  const generateReport = () => {
    if (!reportData || !reportData.vouchers) {
      setError('조회된 데이터가 없습니다. 먼저 내역을 조회해주세요.');
      return;
    }

    // 이미 조회된 데이터를 사용하여 보고서 생성
    generateReportHTML(reportData.vouchers);
  };

  // 보고서 HTML 생성 및 출력
  const generateReportHTML = (allVouchers: any[]) => {
    // 전체 통계 계산
    const totalCount = allVouchers.length;
    const totalAmount = allVouchers.reduce((sum, voucher) => sum + voucher.amount, 0);

    // 교환권명별 집계
    const templateGroups = allVouchers.reduce((groups, voucher) => {
      // usage-report API에서 반환하는 데이터 구조 기준
      const templateName = voucher.template_info?.voucher_name || 
                          (voucher.template_id ? `템플릿 ${voucher.template_id}` : '템플릿 정보 없음');
      
      if (!groups[templateName]) {
        groups[templateName] = { count: 0, amount: 0, vouchers: [] };
      }
      groups[templateName].count++;
      groups[templateName].amount += voucher.amount;
      groups[templateName].vouchers.push(voucher);
      return groups;
    }, {} as Record<string, { count: number; amount: number; vouchers: any[] }>);


    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>교환권 사용내역 보고서</title>
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
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .summary-content {
            flex: 1;
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
          .approval-section {
            margin-left: 20px;
            border: 1px solid #000;
            display: inline-block;
          }
          .approval-titles {
            display: flex;
            border-bottom: 1px solid #000;
          }
          .approval-title {
            font-size: 10pt;
            background: #f0f0f0;
            width: 12mm;
            height: 5mm;
            display: flex;
            align-items: center;
            justify-content: center;
            border-right: 1px solid #000;
            box-sizing: border-box;
          }
          .approval-title:last-child {
            border-right: none;
          }
          .approval-signatures {
            display: flex;
          }
          .approval-signature {
            width: 12mm;
            height: 12mm;
            border-right: 1px solid #000;
            box-sizing: border-box;
          }
          .approval-signature:last-child {
            border-right: none;
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
          .template-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-bottom: 20px;
          }
          .template-card {
            background: white;
            padding: 10px;
            border-radius: 5px;
            border: 1px solid #dee2e6;
            text-align: center;
            font-size: 10pt;
          }
          .template-card .name {
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
          }
          .template-card .count {
            color: #007bff;
            font-size: 14pt;
          }
          .template-card .amount {
            color: #28a745;
            font-size: 12pt;
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
          }
          th { 
            background-color: #f8f9fa; 
            font-weight: bold; 
            color: #2c3e50;
          }
          .amount { 
            text-align: right !important; 
          }
          @media print {
            body { margin: 0; font-size: 10pt; }
            .header h1 { font-size: 18pt; }
            table { font-size: 8pt; }
          }
        </style>
        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
            }, 500);
          };
        </script>
      </head>
      <body>
        <div class="header">
          <h1>교환권 사용내역 보고서</h1>
          <div class="date">출력일: ${new Date().toLocaleDateString('ko-KR')} | 조회기간: ${startDate} ~ ${endDate}</div>
          ${selectedTemplate !== 'all' ? `<div class="date">템플릿: ${templates.find(t => t.id === selectedTemplate)?.voucher_name || '선택됨'}</div>` : ''}
          ${selectedSite !== 'auto' ? `<div class="date">사용처: ${sites.find(s => s.id === selectedSite)?.site_name || '선택됨'}</div>` : ''}
        </div>

        <div class="summary">
          <div class="summary-content">
            <h2>전체현황</h2>
            <div class="summary-item"><strong>총 건수:</strong> ${totalCount}건</div>
            <div class="summary-item"><strong>총 금액:</strong> ${totalAmount.toLocaleString()}원</div>
          </div>
          <div class="approval-section">
            <div class="approval-titles">
              <div class="approval-title">담당자</div>
              <div class="approval-title">책임자</div>
            </div>
            <div class="approval-signatures">
              <div class="approval-signature"></div>
              <div class="approval-signature"></div>
            </div>
          </div>
        </div>

        ${Object.keys(templateGroups).length > 0 ? `
        <div class="section">
          <h3>교환권명별 현황</h3>
          <table>
            <thead>
              <tr>
                <th>교환권명</th>
                <th>수량</th>
                <th>합계액</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(templateGroups)
                .sort(([,a], [,b]) => (b as any).amount - (a as any).amount) // 합계액 순으로 정렬
                .map(([templateName, data]) => `
                  <tr>
                    <td>${templateName}</td>
                    <td style="text-align: center;">${(data as any).count}건</td>
                    <td class="amount">${(data as any).amount.toLocaleString()}원</td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${Object.keys(templateGroups).length > 0 ? `
        <div class="section">
          <h3>교환권명별 상세내역</h3>
          ${Object.entries(templateGroups)
            .sort(([,a], [,b]) => (b as any).amount - (a as any).amount) // 합계액 순으로 정렬
            .map(([templateName, data]) => `
            <h4>${templateName} (${(data as any).count}건, ${(data as any).amount.toLocaleString()}원)</h4>
            <table>
              <thead>
                <tr>
                  <th>순번</th>
                  <th>일련번호</th>
                  <th>영농회</th>
                  <th>성명</th>
                  <th>금액</th>
                  <th>발행일</th>
                  <th>사용일</th>
                  <th>사용처</th>
                </tr>
              </thead>
              <tbody>
                ${(data as any).vouchers
                  .sort((a: any, b: any) => {
                    // 사용일 기준 정렬 (usage-report API 데이터 구조)
                    const aDate = new Date(a.used_date || a.used_at || 0).getTime();
                    const bDate = new Date(b.used_date || b.used_at || 0).getTime();
                    if (aDate === bDate) {
                      return a.name.localeCompare(b.name);
                    }
                    return aDate - bDate;
                  })
                  .map((voucher: any, idx: any) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${voucher.serial_no}</td>
                      <td>${voucher.association || ''}</td>
                      <td>${voucher.name}</td>
                      <td class="amount">${voucher.amount.toLocaleString()}</td>
                      <td>${voucher.issued_at ? new Date(voucher.issued_at).toLocaleDateString('ko-KR') : ''}</td>
                      <td>${voucher.used_date || (voucher.used_at ? new Date(voucher.used_at).toLocaleDateString('ko-KR') : '')}</td>
                      <td>${voucher.site_name || ''}</td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>
          `).join('')}
        </div>
        ` : ''}

        ${allVouchers.length === 0 ? `
        <div class="section">
          <p style="text-align: center; color: #666; font-size: 16px; padding: 40px;">
            선택한 조건에 해당하는 교환권 사용내역이 없습니다.
          </p>
        </div>
        ` : ''}
      </body>
      </html>
    `;

    // 새 창에서 보고서 열기
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(reportHTML);
      printWindow.document.close();
    } else {
      setError('팝업 차단으로 인해 보고서를 열 수 없습니다.');
    }
  };

  // 페이지 로드 시 데이터 조회
  useEffect(() => {
    fetchTemplates();
    if (isAdmin) {
      fetchSites();
    }
  }, [isAdmin]);

  // 데이터가 로드되면 기본 리포트 조회
  useEffect(() => {
    if (startDate && endDate && !templatesLoading && (!isAdmin || !sitesLoading)) {
      fetchReportData();
    }
  }, [user?.id, templatesLoading, sitesLoading, isAdmin]); // 모든 데이터가 로드되면 자동 조회

  return (
    <MobileLayout>
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        paddingBottom: '100px'
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
            사용등록 내역 출력
          </h1>

          {/* 사용처 선택 (관리자만) */}
          {isAdmin && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '4px'
              }}>
                조회할 사용처 선택
              </label>
              <select
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                disabled={sitesLoading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '16px',
                  backgroundColor: sitesLoading ? '#f3f4f6' : 'white',
                  color: '#374151'
                }}
              >
                <option value="all">전체 사용처</option>
                <option value="auto">내 소속 사업장</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.site_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 템플릿 선택 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              color: '#6b7280',
              marginBottom: '4px'
            }}>
              출력할 템플릿 선택
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              disabled={templatesLoading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '16px',
                backgroundColor: templatesLoading ? '#f3f4f6' : 'white',
                color: '#374151'
              }}
            >
              <option value="all">전체 템플릿</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.voucher_name} ({template.voucher_type})
                </option>
              ))}
            </select>
          </div>

          {/* 날짜 범위 선택 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            marginBottom: '16px'
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '4px'
              }}>
                시작일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '16px'
                }}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '4px'
              }}>
                종료일
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '16px'
                }}
              />
            </div>
          </div>

          {/* 조회 버튼 */}
          <button
            onClick={fetchReportData}
            disabled={loading || !startDate || !endDate}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: (loading || !startDate || !endDate) ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600'
            }}
          >
            {loading ? '조회 중...' : '내역 조회'}
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div style={{
            margin: '20px',
            padding: '16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626'
          }}>
            {error}
          </div>
        )}

        {/* 리포트 데이터 */}
        {reportData && (
          <div style={{ padding: '20px' }}>
            {/* 요약 정보 */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '16px'
              }}>
                전체 요약
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#3b82f6'
                  }}>
                    {reportData.summary.totalCount}건
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#6b7280'
                  }}>
                    총 사용 건수
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#059669'
                  }}>
                    {reportData.summary.totalAmount.toLocaleString()}원
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#6b7280'
                  }}>
                    총 사용 금액
                  </div>
                </div>
              </div>
            </div>

            {/* 일자별 통계 */}
            {reportData.byDate.length > 0 && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '12px'
                }}>
                  일자별 현황
                </h3>
                {reportData.byDate.slice(0, 5).map((item) => (
                  <div key={item.date} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #f3f4f6'
                  }}>
                    <span style={{ fontSize: '14px', color: '#374151' }}>
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>
                      {item.count}건 / {item.amount.toLocaleString()}원
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 템플릿별 통계 */}
            {reportData.byTemplate.length > 0 && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '12px'
                }}>
                  템플릿별 현황
                </h3>
                {reportData.byTemplate.map((item) => (
                  <div key={item.template_id} style={{
                    padding: '12px 0',
                    borderBottom: '1px solid #f3f4f6'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px'
                    }}>
                      <span style={{ 
                        fontSize: '14px', 
                        fontWeight: '500',
                        color: '#374151' 
                      }}>
                        {item.template_name}
                      </span>
                      <span style={{ fontSize: '14px', color: '#6b7280' }}>
                        {item.count}건
                      </span>
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#9ca3af'
                    }}>
                      {item.template_type} • {item.amount.toLocaleString()}원
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 보고서 출력 버튼 */}
            <button
              onClick={generateReport}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '18px',
                fontWeight: '600',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📄 보고서 출력하기
            </button>
          </div>
        )}

        {/* 데이터 없음 */}
        {reportData && reportData.summary.totalCount === 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '40px 24px',
            margin: '20px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '8px'
            }}>
              사용등록 내역이 없습니다
            </h3>
            <p style={{
              color: '#6b7280',
              fontSize: '16px',
              lineHeight: '1.5'
            }}>
              선택한 기간에 사용등록한 교환권이 없습니다.<br/>
              날짜 범위를 변경해서 다시 조회해보세요.
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}