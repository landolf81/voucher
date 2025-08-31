'use client';

/**
 * Mobile Voucher Management Component
 * Admin interface for mobile voucher batch issuance and management
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';

interface Template {
  id: string;
  voucher_name: string;
  voucher_type: string;
  status: string;
}

interface MobileDesignTemplate {
  id: string;
  template_id: string;
  name: string;
  description?: string;
  background_color: string;
  text_color: string;
  accent_color: string;
  font_family: string;
  width: number;
  height: number;
  is_default: boolean;
  status: string;
}

interface Site {
  id: string;
  site_name: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface MobileBatch {
  id: string;
  batch_name: string;
  total_count: number;
  generated_count: number;
  status: string;
  expires_at: string;
  created_at: string;
  link_token: string;
  download_count: number;
  user_profiles: {
    name: string;
  };
  voucher_templates: {
    voucher_name: string;
  };
}

interface VoucherFormData {
  name: string;
  association: string;
  member_id: string;
  amount: number;
  dob: string;
  phone: string;
}

export function MobileVoucherManagement() {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<'create' | 'history' | 'analytics'>('create');
  
  // Form states
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [batches, setBatches] = useState<MobileBatch[]>([]);
  
  // Create form state
  const [selectedUserId, setSelectedUserId] = useState(user?.id || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedDesignTemplateId, setSelectedDesignTemplateId] = useState('');
  const [batchName, setBatchName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [vouchers, setVouchers] = useState<VoucherFormData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Mobile design template states
  const [mobileDesignTemplates, setMobileDesignTemplates] = useState<MobileDesignTemplate[]>([]);
  const [loadingDesignTemplates, setLoadingDesignTemplates] = useState(false);

  // Data source selection - default to 'existing' only (removed 'new' option)
  const [dataSource, setDataSource] = useState<'existing'>('existing');
  const [existingVouchers, setExistingVouchers] = useState<any[]>([]);
  const [selectedExistingVouchers, setSelectedExistingVouchers] = useState<Set<string>>(new Set());
  const [loadingExisting, setLoadingExisting] = useState(false);

  // Search filters for existing vouchers
  const [searchFilters, setSearchFilters] = useState({
    serial_no: '',
    name: '',
    association: '',
    member_id: ''
  });

  // Excel import state
  const [isImporting, setIsImporting] = useState(false);

  // Preview state
  const [previewTemplate, setPreviewTemplate] = useState<MobileDesignTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Batch detail state
  const [selectedBatch, setSelectedBatch] = useState<MobileBatch | null>(null);
  const [batchVouchers, setBatchVouchers] = useState<any[]>([]);
  const [showBatchDetail, setShowBatchDetail] = useState(false);
  const [loadingBatchDetail, setLoadingBatchDetail] = useState(false);

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [cleanupStats, setCleanupStats] = useState<any>(null);
  const [loadingCleanup, setLoadingCleanup] = useState(false);
  const [shortUrlStats, setShortUrlStats] = useState<any>(null);

  // Load initial data
  useEffect(() => {
    loadTemplates();
    loadSites();
    loadUsers();
    loadBatchHistory();
  }, []);

  // 사용자 로그인 정보 변경 시 selectedUserId 업데이트
  useEffect(() => {
    if (user?.id) {
      setSelectedUserId(user.id);
    }
  }, [user?.id]);

  // 템플릿 선택 시 기존 대상자 로드
  useEffect(() => {
    if (selectedTemplateId) {
      loadExistingVouchers();
    }
  }, [selectedTemplateId]);

  // 교환권 템플릿 선택 시 모바일 디자인 템플릿 로드
  useEffect(() => {
    if (selectedTemplateId) {
      loadMobileDesignTemplates(selectedTemplateId);
    } else {
      setMobileDesignTemplates([]);
      setSelectedDesignTemplateId('');
    }
  }, [selectedTemplateId]);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/voucher-templates');
      if (response.ok) {
        const data = await response.json();
        console.log('Templates loaded:', data);
        setTemplates(data.data || []); // API에서 data 필드로 반환
      }
    } catch (error) {
      console.error('템플릿 로드 오류:', error);
    }
  };

  const loadSites = async () => {
    try {
      const response = await fetch('/api/sites');
      if (response.ok) {
        const data = await response.json();
        console.log('Sites loaded:', data);
        setSites(data.data || []); // API에서 data 필드로 반환
      }
    } catch (error) {
      console.error('사업장 로드 오류:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/user-profiles');
      if (response.ok) {
        const data = await response.json();
        console.log('Users loaded:', data);
        setUsers(data.data?.users || []); // API에서 data.users 필드로 반환
      }
    } catch (error) {
      console.error('사용자 로드 오류:', error);
    }
  };

  const loadBatchHistory = async () => {
    try {
      // 현재 사용자의 배치만 조회하도록 user_id 파라미터 추가
      const response = await fetch(`/api/vouchers/mobile-bulk-issue?user_id=${user?.id}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Batch history loaded:', data);
        setBatches(data.data || []);
      }
    } catch (error) {
      console.error('배치 히스토리 로드 오류:', error);
    }
  };

  // 모바일 디자인 템플릿 로드
  const loadMobileDesignTemplates = async (templateId: string) => {
    setLoadingDesignTemplates(true);
    try {
      const response = await fetch(`/api/mobile-templates?template_id=${templateId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Mobile design templates loaded:', data);
        const designTemplates = data.data || [];
        setMobileDesignTemplates(designTemplates);
        
        // 기본 템플릿이 있으면 자동 선택, 없으면 첫 번째 템플릿 선택
        const defaultTemplate = designTemplates.find((t: MobileDesignTemplate) => t.is_default);
        if (defaultTemplate) {
          setSelectedDesignTemplateId(defaultTemplate.id);
        } else if (designTemplates.length > 0) {
          setSelectedDesignTemplateId(designTemplates[0].id);
        } else {
          setSelectedDesignTemplateId(''); // 기본 디자인 사용
        }
      }
    } catch (error) {
      console.error('모바일 디자인 템플릿 로드 오류:', error);
      setMobileDesignTemplates([]);
      setSelectedDesignTemplateId('');
    } finally {
      setLoadingDesignTemplates(false);
    }
  };

  // 기존 등록 대상자 불러오기 (재발행 포함)
  const loadExistingVouchers = async (searchParams?: {
    serial_no?: string;
    name?: string;
    association?: string;
    member_id?: string;
  }) => {
    if (!selectedTemplateId) return;

    setLoadingExisting(true);
    try {
      // 등록됨(registered)과 발행됨(issued) 상태 모두 조회 가능
      let url = `/api/vouchers?template_id=${selectedTemplateId}&status=issuable&limit=1000`;
      
      // 검색 파라미터 추가
      if (searchParams?.serial_no) url += `&serial_no=${searchParams.serial_no}`;
      if (searchParams?.name) url += `&name=${searchParams.name}`;
      if (searchParams?.association) url += `&association=${searchParams.association}`;
      if (searchParams?.member_id) url += `&member_id=${searchParams.member_id}`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log('Existing vouchers loaded:', data);
        setExistingVouchers(data.data || []);
        setSelectedExistingVouchers(new Set());
      }
    } catch (error) {
      console.error('기존 대상자 로드 오류:', error);
    } finally {
      setLoadingExisting(false);
    }
  };

  // 검색 필터 기반 조회 함수
  const handleSearch = () => {
    const hasFilters = Object.values(searchFilters).some(value => value.trim() !== '');
    loadExistingVouchers(hasFilters ? searchFilters : undefined);
  };

  // 검색 필터 초기화
  const handleResetFilters = () => {
    setSearchFilters({
      serial_no: '',
      name: '',
      association: '',
      member_id: ''
    });
    loadExistingVouchers();
  };

  // Show design preview
  const showDesignPreview = (designTemplateId: string) => {
    const template = mobileDesignTemplates.find(t => t.id === designTemplateId);
    if (template) {
      setPreviewTemplate(template);
      setShowPreview(true);
    }
  };

  // Close preview
  const closePreview = () => {
    setShowPreview(false);
    setPreviewTemplate(null);
  };

  // Show batch detail with individual voucher links
  const handleShowBatchDetail = async (batch: MobileBatch) => {
    setSelectedBatch(batch);
    setLoadingBatchDetail(true);
    setShowBatchDetail(true);

    try {
      const response = await fetch(`/api/vouchers/mobile-batch/${batch.id}/vouchers`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Check if data structure is correct
        if (data.data && data.data.vouchers) {
          setBatchVouchers(data.data.vouchers);
        } else {
          console.warn('배치 교환권 데이터 구조 확인:', data);
          setBatchVouchers([]);
        }
      } else {
        console.error('배치 교환권 조회 실패:', data.error || '서버 오류');
        alert(`배치 교환권 조회 실패: ${data.error || '서버 오류가 발생했습니다.'}`);
        setBatchVouchers([]);
        setShowBatchDetail(false);
      }
    } catch (error) {
      console.error('배치 교환권 조회 오류:', error);
      alert('배치 교환권 조회 중 오류가 발생했습니다.');
      setBatchVouchers([]);
      setShowBatchDetail(false);
    } finally {
      setLoadingBatchDetail(false);
    }
  };

  // Close batch detail
  const closeBatchDetail = () => {
    setShowBatchDetail(false);
    setSelectedBatch(null);
    setBatchVouchers([]);
  };

  // Copy individual voucher link with short URL option
  const copyVoucherLink = async (voucher: any) => {
    if (!voucher.mobile_access_url && !voucher.mobile_link_token) {
      alert('링크를 찾을 수 없습니다.');
      return;
    }

    try {
      // mobile_access_url이 없으면 mobile_link_token으로 URL 생성
      const originalUrl = voucher.mobile_access_url || 
        `${window.location.origin}/mobile/vouchers/${voucher.mobile_link_token}`;

      // 단축 URL 생성 시도
      const response = await fetch('/api/short-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_url: originalUrl,
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90일
          user_id: user?.id,
          metadata: {
            voucher_id: voucher.id,
            voucher_name: voucher.name,
            source: 'individual_voucher'
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.short_url) {
          // 단축 URL 복사
          await navigator.clipboard.writeText(result.data.short_url);
          alert(`${voucher.name}의 단축 링크가 복사되었습니다.\n${result.data.short_url}`);
          return;
        }
      }

      // 단축 URL 생성 실패 시 원본 URL 복사
      await navigator.clipboard.writeText(originalUrl);
      alert(`${voucher.name}의 교환권 링크가 복사되었습니다.\n${originalUrl}`);
    } catch (error) {
      console.error('링크 복사 오류:', error);
      const originalUrl = voucher.mobile_access_url || 
        `${window.location.origin}/mobile/vouchers/${voucher.mobile_link_token}`;
      await navigator.clipboard.writeText(originalUrl);
      alert(`${voucher.name}의 교환권 링크가 복사되었습니다.`);
    }
  };

  // Copy all voucher links
  const copyAllVoucherLinks = () => {
    const links = batchVouchers
      .filter(v => v.mobile_access_url)
      .map(v => `${v.name} (${v.association}): ${v.mobile_access_url}`)
      .join('\n');
    
    if (links) {
      navigator.clipboard.writeText(links);
      alert(`${batchVouchers.length}개 교환권 링크가 모두 복사되었습니다.`);
    } else {
      alert('복사할 링크가 없습니다.');
    }
  };

  // 행추가 기능 제거됨 - 기존 등록된 대상자만 사용
  // const addVoucherRow = () => {
  //   setVouchers([...vouchers, {
  //     name: '',
  //     association: '',
  //     member_id: '',
  //     amount: 0,
  //     dob: '',
  //     phone: ''
  //   }]);
  // };

  // Remove voucher row
  const removeVoucherRow = (index: number) => {
    setVouchers(vouchers.filter((_, i) => i !== index));
  };

  // Update voucher data
  const updateVoucherData = (index: number, field: keyof VoucherFormData, value: any) => {
    const updated = [...vouchers];
    updated[index] = { ...updated[index], [field]: value };
    setVouchers(updated);
  };

  // Toggle existing voucher selection
  const handleToggleExistingVoucher = (voucherId: string) => {
    const newSelected = new Set(selectedExistingVouchers);
    if (newSelected.has(voucherId)) {
      newSelected.delete(voucherId);
    } else {
      newSelected.add(voucherId);
    }
    setSelectedExistingVouchers(newSelected);
  };

  // Select all existing vouchers
  const handleSelectAllExisting = () => {
    if (selectedExistingVouchers.size === existingVouchers.length) {
      setSelectedExistingVouchers(new Set());
    } else {
      setSelectedExistingVouchers(new Set(existingVouchers.map(v => v.id)));
    }
  };

  // Excel 가져오기 기능 제거됨 - 기존 등록된 대상자만 사용
  // const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = event.target.files?.[0];
  //   if (!file) return;

  //   setIsImporting(true);
  //   try {
  //     const formData = new FormData();
  //     formData.append('file', file);

  //     const response = await fetch('/api/vouchers/import-excel', {
  //       method: 'POST',
  //       body: formData,
  //     });

  //     if (response.ok) {
  //       const data = await response.json();
  //       setVouchers(data.vouchers || []);
  //       alert(`${data.vouchers?.length || 0}개의 교환권 데이터를 가져왔습니다.`);
  //     } else {
  //       const error = await response.json();
  //       alert(`Excel 가져오기 실패: ${error.message}`);
  //     }
  //   } catch (error) {
  //     console.error('Excel 가져오기 오류:', error);
  //     alert('Excel 파일 처리 중 오류가 발생했습니다.');
  //   } finally {
  //     setIsImporting(false);
  //     event.target.value = ''; // Reset file input
  //   }
  // };

  // Submit mobile batch issuance
  const handleSubmit = async () => {
    if (!selectedUserId || !selectedTemplateId || !batchName) {
      alert('모든 필수 필드를 입력해주세요.');
      return;
    }

    // Validate selected existing vouchers
    if (selectedExistingVouchers.size === 0) {
      alert('발행할 기존 대상자를 선택해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 기존 대상자 발행
      const requestBody = {
        user_id: selectedUserId,
        template_id: selectedTemplateId,
        design_template_id: selectedDesignTemplateId || null,
        batch_name: batchName,
        existing_voucher_ids: Array.from(selectedExistingVouchers),
        expires_in_days: expiresInDays
      };

      const response = await fetch('/api/vouchers/mobile-bulk-issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const linkInfo = result.data.is_shortened ? 
          `단축 URL: ${result.data.short_url}\n원본 URL: ${result.data.access_url}` :
          `액세스 링크: ${result.data.access_url}`;
        
        alert(`${result.message}\n\n${linkInfo}`);
        
        // Reset form
        setSelectedUserId(user?.id || '');
        setSelectedTemplateId('');
        setSelectedDesignTemplateId('');
        setBatchName('');
        setExpiresInDays(90);
        setSelectedExistingVouchers(new Set());
        setExistingVouchers([]);
        setMobileDesignTemplates([]);
        setSearchFilters({
          serial_no: '',
          name: '',
          association: '',
          member_id: ''
        });
        
        // Reload batch history
        loadBatchHistory();
        
        // Switch to history tab
        setCurrentTab('history');
      } else {
        alert(`발행 실패: ${result.message}`);
      }

    } catch (error) {
      console.error('모바일 일괄 발행 오류:', error);
      alert('서버 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy link to clipboard
  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/mobile/vouchers/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      alert('원본 링크가 클립보드에 복사되었습니다.');
    } catch (error) {
      alert(`링크: ${url}`);
    }
  };

  // Copy short link to clipboard
  const copyShortLink = async (token: string) => {
    try {
      // 단축 URL 생성 API 호출
      const response = await fetch('/api/short-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_url: `${window.location.origin}/mobile/vouchers/${token}`,
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90일 후
          user_id: user?.id,
          metadata: { token, source: 'batch_management' }
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await navigator.clipboard.writeText(result.data.short_url);
          alert(`단축 링크가 복사되었습니다!\n길이: ${result.data.short_url.length}자 (${result.data.reduction_percentage}% 단축)`);
        } else {
          throw new Error(result.message);
        }
      } else {
        throw new Error('단축 URL 생성 실패');
      }
    } catch (error) {
      console.error('단축 링크 생성 오류:', error);
      // 실패 시 원본 링크 복사
      const url = `${window.location.origin}/mobile/vouchers/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        alert('단축 링크 생성에 실패하여 원본 링크를 복사했습니다.');
      } catch {
        alert(`단축 링크 생성 실패. 원본 링크: ${url}`);
      }
    }
  };

  // Load analytics data
  const loadAnalyticsData = async () => {
    setLoadingAnalytics(true);
    try {
      const response = await fetch(`/api/dashboard/stats`);
      if (response.ok) {
        const data = await response.json();
        console.log('Analytics data loaded:', data);
        setAnalyticsData(data.data || {});
      }
    } catch (error) {
      console.error('분석 데이터 로드 오류:', error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Load cleanup statistics
  const loadCleanupStats = async () => {
    setLoadingCleanup(true);
    try {
      const response = await fetch('/api/vouchers/mobile-batch/cleanup?days_before=30');
      if (response.ok) {
        const data = await response.json();
        console.log('Cleanup stats loaded:', data);
        setCleanupStats(data.data || {});
      }
    } catch (error) {
      console.error('정리 통계 로드 오류:', error);
    } finally {
      setLoadingCleanup(false);
    }
  };

  // Execute cleanup
  const executeCleanup = async (dryRun: boolean = false) => {
    const confirmed = dryRun || confirm('정말로 만료된 배치를 정리하시겠습니까? 이 작업은 되돌릴 수 없습니다.');
    if (!confirmed) return;

    setLoadingCleanup(true);
    try {
      const response = await fetch(`/api/vouchers/mobile-batch/cleanup?dry_run=${dryRun}&days_before=30`, {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        loadCleanupStats(); // 통계 새로고침
        loadBatchHistory(); // 배치 히스토리 새로고침
      } else {
        const error = await response.json();
        alert(`정리 실패: ${error.message}`);
      }
    } catch (error) {
      console.error('정리 실행 오류:', error);
      alert('정리 실행 중 오류가 발생했습니다.');
    } finally {
      setLoadingCleanup(false);
    }
  };

  // Load short URL statistics
  const loadShortUrlStats = async () => {
    try {
      const response = await fetch('/api/short-url');
      if (response.ok) {
        const data = await response.json();
        console.log('Short URL stats loaded:', data);
        setShortUrlStats(data.data || {});
      }
    } catch (error) {
      console.error('단축 URL 통계 로드 오류:', error);
    }
  };

  // Load analytics when tab changes
  useEffect(() => {
    if (currentTab === 'analytics') {
      loadAnalyticsData();
      loadCleanupStats();
      loadShortUrlStats();
    }
  }, [currentTab]);

  return (
    <div>
      <h3 style={{
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#1a202c',
        marginBottom: '24px'
      }}>
        📱 모바일 교환권 관리
      </h3>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <button
          onClick={() => setCurrentTab('create')}
          style={{
            padding: '12px 24px',
            backgroundColor: currentTab === 'create' ? '#3b82f6' : 'transparent',
            color: currentTab === 'create' ? 'white' : '#64748b',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          📱 새 배치 생성
        </button>
        <button
          onClick={() => setCurrentTab('history')}
          style={{
            padding: '12px 24px',
            backgroundColor: currentTab === 'history' ? '#3b82f6' : 'transparent',
            color: currentTab === 'history' ? 'white' : '#64748b',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          📋 배치 히스토리
        </button>
        <button
          onClick={() => setCurrentTab('analytics')}
          style={{
            padding: '12px 24px',
            backgroundColor: currentTab === 'analytics' ? '#3b82f6' : 'transparent',
            color: currentTab === 'analytics' ? 'white' : '#64748b',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          📊 사용 분석
        </button>
      </div>

      {/* Create Tab */}
      {currentTab === 'create' && (
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          {/* Basic Settings */}
          <div style={{ marginBottom: '32px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>
              기본 설정
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                  발행 사용자
                </label>
                <div style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#6b7280'
                }}>
                  {user?.name || '현재 사용자'} ({user?.email || ''})
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                  교환권 템플릿 *
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">템플릿 선택</option>
                  {templates.filter(t => t.status === 'active').map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.voucher_name} ({template.voucher_type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Mobile Design Template Selection */}
              {selectedTemplateId && (
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                    모바일 디자인
                  </label>
                  <select
                    value={selectedDesignTemplateId}
                    onChange={(e) => setSelectedDesignTemplateId(e.target.value)}
                    disabled={loadingDesignTemplates}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: loadingDesignTemplates ? '#f9fafb' : 'white',
                      color: loadingDesignTemplates ? '#6b7280' : 'black'
                    }}
                  >
                    <option value="">기본 디자인 사용</option>
                    {mobileDesignTemplates.filter(t => t.status === 'active').map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.is_default && ' (기본)'}
                      </option>
                    ))}
                  </select>
                  {loadingDesignTemplates && (
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                      디자인 템플릿 로딩 중...
                    </div>
                  )}
                  {selectedTemplateId && !loadingDesignTemplates && mobileDesignTemplates.length === 0 && (
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                      이 템플릿에는 커스텀 모바일 디자인이 없습니다. 기본 디자인이 사용됩니다.
                    </div>
                  )}
                  {selectedDesignTemplateId && (
                    <div style={{ marginTop: '8px' }}>
                      <button
                        type="button"
                        onClick={() => showDesignPreview(selectedDesignTemplateId)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: '#f3f4f6',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          color: '#374151',
                          cursor: 'pointer'
                        }}
                      >
                        📱 디자인 미리보기
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                  배치명 *
                </label>
                <input
                  type="text"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="예: 2025년 1월 교환권 발행"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                  링크 만료 기간
                </label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                >
                  <option value={1}>1일</option>
                  <option value={3}>3일</option>
                  <option value={7}>1주일</option>
                  <option value={14}>2주일</option>
                  <option value={30}>1개월</option>
                  <option value={90}>3개월 (기본)</option>
                  <option value={180}>6개월</option>
                  <option value={365}>1년</option>
                </select>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  링크는 선택한 기간 후 자동으로 만료됩니다
                </div>
              </div>
            </div>
          </div>

          {/* Existing Vouchers Section */}
          {selectedTemplateId && (
            <div style={{ marginBottom: '32px' }}>
              <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>
                등록된 대상자 검색 및 선택
              </h4>

              {/* Search Filters */}
              <div style={{
                backgroundColor: '#f8fafc',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '16px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  marginBottom: '16px'
                }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px', color: '#374151' }}>
                      일련번호
                    </label>
                    <input
                      type="text"
                      value={searchFilters.serial_no}
                      onChange={(e) => setSearchFilters({ ...searchFilters, serial_no: e.target.value })}
                      placeholder="일련번호 검색"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px', color: '#374151' }}>
                      성명
                    </label>
                    <input
                      type="text"
                      value={searchFilters.name}
                      onChange={(e) => setSearchFilters({ ...searchFilters, name: e.target.value })}
                      placeholder="성명 검색"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px', color: '#374151' }}>
                      영농회
                    </label>
                    <input
                      type="text"
                      value={searchFilters.association}
                      onChange={(e) => setSearchFilters({ ...searchFilters, association: e.target.value })}
                      placeholder="영농회명 검색"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px', color: '#374151' }}>
                      회원번호
                    </label>
                    <input
                      type="text"
                      value={searchFilters.member_id}
                      onChange={(e) => setSearchFilters({ ...searchFilters, member_id: e.target.value })}
                      placeholder="회원번호 검색"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={handleSearch}
                    disabled={loadingExisting}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: loadingExisting ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    🔍 검색
                  </button>
                  <button
                    onClick={handleResetFilters}
                    disabled={loadingExisting}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: loadingExisting ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    🔄 초기화
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>
                  검색결과 ({existingVouchers.length}개)
                </h4>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={loadExistingVouchers}
                    disabled={loadingExisting}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: loadingExisting ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    {loadingExisting ? '로딩 중...' : '🔄 새로고침'}
                  </button>
                  {existingVouchers.length > 0 && (
                    <button
                      onClick={handleSelectAllExisting}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      {selectedExistingVouchers.size === existingVouchers.length ? '전체 해제' : '전체 선택'}
                    </button>
                  )}
                </div>
              </div>

              {existingVouchers.length > 0 ? (
                <div style={{
                  maxHeight: '400px',
                  overflowY: 'auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9fafb', zIndex: 1 }}>
                      <tr>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>선택</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>이름</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>영농회</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>회원번호</th>
                        <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>금액</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>일련번호</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingVouchers.map((voucher) => (
                        <tr key={voucher.id} style={{ backgroundColor: selectedExistingVouchers.has(voucher.id) ? '#f0f9ff' : 'white' }}>
                          <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedExistingVouchers.has(voucher.id)}
                              onChange={() => handleToggleExistingVoucher(voucher.id)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', fontWeight: '500' }}>
                            {voucher.name}
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>
                            {voucher.association}
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>
                            {voucher.member_id}
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontWeight: '500' }}>
                            {voucher.amount?.toLocaleString()}원
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', fontSize: '12px', fontFamily: 'monospace', color: '#6b7280' }}>
                            {voucher.serial_no}
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '500',
                              backgroundColor: voucher.status === 'registered' ? '#dcfce7' : voucher.status === 'issued' ? '#fef3c7' : '#f3f4f6',
                              color: voucher.status === 'registered' ? '#166534' : voucher.status === 'issued' ? '#92400e' : '#6b7280'
                            }}>
                              {voucher.status === 'registered' ? '등록' : voucher.status === 'issued' ? '발행' : voucher.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#9ca3af',
                  border: '2px dashed #d1d5db',
                  borderRadius: '8px'
                }}>
                  {loadingExisting ? (
                    <p>기존 대상자를 불러오는 중...</p>
                  ) : (
                    <>
                      <p>선택한 템플릿에 등록된 대상자가 없습니다.</p>
                      <p style={{ fontSize: '14px', marginTop: '8px' }}>
                        📝 "발행대상 등록" 탭에서 먼저 대상자를 등록해주세요.
                      </p>
                    </>
                  )}
                </div>
              )}

              {selectedExistingVouchers.size > 0 && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px 16px',
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #3b82f6',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#1e40af'
                }}>
                  ✅ {selectedExistingVouchers.size}개의 대상자가 선택되었습니다.
                </div>
              )}
            </div>
          )}


          {/* Global Submit Button */}
          <div style={{ marginTop: '32px', textAlign: 'center' }}>
            <button
              onClick={handleSubmit}
              disabled={
                isSubmitting || 
                !selectedUserId || 
                !selectedTemplateId || 
                !batchName ||
                selectedExistingVouchers.size === 0
              }
              style={{
                padding: '16px 32px',
                backgroundColor: 
                  isSubmitting || 
                  !selectedUserId || 
                  !selectedTemplateId || 
                  !batchName ||
                  selectedExistingVouchers.size === 0
                    ? '#9ca3af' 
                    : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 
                  isSubmitting || 
                  !selectedUserId || 
                  !selectedTemplateId || 
                  !batchName ||
                  selectedExistingVouchers.size === 0
                    ? 'not-allowed' 
                    : 'pointer',
                fontSize: '16px',
                fontWeight: '600'
              }}
            >
              {isSubmitting ? (
                '📱 모바일 교환권 생성 중...'
              ) : (
                `📱 모바일 교환권 발행 (선택: ${selectedExistingVouchers.size}개)`
              )}
            </button>
          </div>
        </div>
      )}

      {/* History Tab */}
      {currentTab === 'history' && (
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: '600', color: '#374151' }}>
              배치 히스토리 ({batches.length}개)
            </h4>
            <button
              onClick={loadBatchHistory}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🔄 새로고침
            </button>
          </div>

          {batches.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>배치명</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>발행자</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>수량</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>상태</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>다운로드</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>생성일</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id}>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                        <div>
                          <div style={{ fontWeight: '500' }}>{batch.batch_name}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>{batch.voucher_templates.voucher_name}</div>
                        </div>
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                        {batch.user_profiles.name}
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                        {batch.generated_count}/{batch.total_count}
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: 
                            batch.status === 'completed' ? '#dcfce7' :
                            batch.status === 'failed' ? '#fecaca' :
                            batch.status === 'generating' ? '#fef3c7' : '#f3f4f6',
                          color:
                            batch.status === 'completed' ? '#166534' :
                            batch.status === 'failed' ? '#dc2626' :
                            batch.status === 'generating' ? '#d97706' : '#6b7280'
                        }}>
                          {batch.status === 'completed' ? '완료' :
                           batch.status === 'failed' ? '실패' :
                           batch.status === 'generating' ? '생성중' : batch.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                        {batch.download_count}회
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: '14px' }}>
                          {new Date(batch.created_at).toLocaleDateString('ko-KR')}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {new Date(batch.created_at).toLocaleTimeString('ko-KR')}
                        </div>
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            onClick={() => copyLink(batch.link_token)}
                            style={{
                              padding: '6px 8px',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                            title="원본 링크 복사"
                          >
                            📋
                          </button>
                          <button
                            onClick={() => copyShortLink(batch.link_token)}
                            style={{
                              padding: '6px 8px',
                              backgroundColor: '#8b5cf6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                            title="단축 링크 복사"
                          >
                            🔗
                          </button>
                          <button
                            onClick={() => handleShowBatchDetail(batch)}
                            style={{
                              padding: '6px 8px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            👁️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: '#9ca3af'
            }}>
              <p>생성된 모바일 교환권 배치가 없습니다.</p>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {currentTab === 'analytics' && (
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: '600', color: '#374151' }}>
              📊 사용 패턴 분석 및 관리
            </h4>
            <button
              onClick={() => {
                loadAnalyticsData();
                loadCleanupStats();
                loadShortUrlStats();
              }}
              disabled={loadingAnalytics || loadingCleanup}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loadingAnalytics || loadingCleanup ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {loadingAnalytics || loadingCleanup ? '로딩 중...' : '🔄 새로고침'}
            </button>
          </div>

          {/* System Overview */}
          {analyticsData && (
            <div style={{ marginBottom: '32px' }}>
              <h5 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>
                시스템 전체 현황
              </h5>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '16px',
                marginBottom: '16px'
              }}>
                <div style={{
                  backgroundColor: '#f0f9ff',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid #0ea5e9'
                }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0ea5e9', marginBottom: '8px' }}>
                    {analyticsData.totalVouchers?.toLocaleString() || '0'}
                  </div>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>총 교환권 수</div>
                </div>
                <div style={{
                  backgroundColor: '#f0fdf4',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid #22c55e'
                }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#22c55e', marginBottom: '8px' }}>
                    {analyticsData.totalSites?.toLocaleString() || '0'}
                  </div>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>활성 사업장 수</div>
                </div>
                <div style={{
                  backgroundColor: '#fefce8',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid #facc15'
                }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#facc15', marginBottom: '8px' }}>
                    {analyticsData.totalUsers?.toLocaleString() || '0'}
                  </div>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>등록 사용자 수</div>
                </div>
                <div style={{
                  backgroundColor: '#fdf2f8',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid #ec4899'
                }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ec4899', marginBottom: '8px' }}>
                    {batches.length}
                  </div>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>모바일 배치 수</div>
                </div>
              </div>
            </div>
          )}

          {/* URL Shortening Statistics */}
          {shortUrlStats && (
            <div style={{ marginBottom: '32px' }}>
              <h5 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>
                URL 단축 통계
              </h5>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                gap: '12px',
                marginBottom: '16px'
              }}>
                <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0ea5e9' }}>
                    {shortUrlStats.total_urls || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>총 단축 URL</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
                    {shortUrlStats.active_urls || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>활성 URL</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#fecaca', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                    {shortUrlStats.expired_urls || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>만료된 URL</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
                    {shortUrlStats.total_clicks || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>총 클릭 수</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#fdf2f8', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ec4899' }}>
                    {shortUrlStats.average_clicks || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>평균 클릭</div>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Batch Statistics */}
          <div style={{ marginBottom: '32px' }}>
            <h5 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>
              모바일 배치 통계
            </h5>
            {batches.length > 0 ? (
              <div>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
                      {batches.filter(b => b.status === 'completed').length}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>완료된 배치</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
                      {batches.filter(b => b.status === 'generating').length}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>생성 중</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                      {batches.filter(b => b.status === 'failed').length}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>실패</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
                      {batches.reduce((sum, b) => sum + (b.download_count || 0), 0)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>총 다운로드 수</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8b5cf6' }}>
                      {batches.reduce((sum, b) => sum + b.total_count, 0)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>총 교환권 수</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px', 
                color: '#9ca3af',
                backgroundColor: '#f9fafb',
                borderRadius: '8px'
              }}>
                <p>모바일 배치 데이터가 없습니다.</p>
              </div>
            )}
          </div>

          {/* Cleanup Management */}
          <div>
            <h5 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>
              배치 정리 관리
            </h5>
            
            {cleanupStats && (
              <div style={{
                backgroundColor: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h6 style={{ fontSize: '14px', fontWeight: '600', color: '#92400e', margin: 0 }}>
                    ⚠️ 정리 대상 (30일 이전 만료)
                  </h6>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    기준일: {cleanupStats.cleanup_date ? new Date(cleanupStats.cleanup_date).toLocaleDateString('ko-KR') : '-'}
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#92400e' }}>
                      {cleanupStats.total_batches || 0}개 배치
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>정리 대상 배치</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#92400e' }}>
                      {cleanupStats.total_vouchers || 0}개 교환권
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>정리 대상 링크</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => executeCleanup(true)}
                    disabled={loadingCleanup || !cleanupStats.total_batches}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: cleanupStats.total_batches ? '#3b82f6' : '#9ca3af',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: cleanupStats.total_batches && !loadingCleanup ? 'pointer' : 'not-allowed',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    🔍 시뮬레이션
                  </button>
                  <button
                    onClick={() => executeCleanup(false)}
                    disabled={loadingCleanup || !cleanupStats.total_batches}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: cleanupStats.total_batches ? '#ef4444' : '#9ca3af',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: cleanupStats.total_batches && !loadingCleanup ? 'pointer' : 'not-allowed',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    🗑️ 실제 정리
                  </button>
                </div>
              </div>
            )}

            <div style={{
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '14px',
              color: '#6b7280'
            }}>
              <h6 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                🛡️ 정리 정책
              </h6>
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                <li>30일 이전에 만료된 배치가 정리 대상입니다</li>
                <li>정리 시 배치는 삭제되지 않고 'cleaned' 상태로 변경됩니다</li>
                <li>교환권의 모바일 링크 토큰만 제거되어 더 이상 접근할 수 없게 됩니다</li>
                <li>시뮬레이션으로 먼저 확인한 후 실제 정리를 수행하세요</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Design Preview Modal */}
      {showPreview && previewTemplate && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>
                모바일 디자인 미리보기
              </h3>
              <button
                onClick={closePreview}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '500' }}>
                {previewTemplate.name}
              </h4>
              {previewTemplate.description && (
                <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: '14px' }}>
                  {previewTemplate.description}
                </p>
              )}
            </div>

            {/* Mobile Voucher Preview */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <div style={{
                width: `${previewTemplate.width || 400}px`,
                height: `${previewTemplate.height || 400}px`,
                backgroundColor: previewTemplate.background_color || '#ffffff',
                color: previewTemplate.text_color || '#1f2937',
                fontFamily: previewTemplate.font_family || 'Pretendard, sans-serif',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                boxSizing: 'border-box',
                transform: 'scale(0.8)',
                transformOrigin: 'center'
              }}>
                <div style={{ 
                  fontSize: '24px', 
                  fontWeight: 'bold', 
                  marginBottom: '8px',
                  color: previewTemplate.accent_color || '#3b82f6'
                }}>
                  교환권 미리보기
                </div>
                <div style={{ fontSize: '16px', marginBottom: '16px', color: '#6b7280' }}>
                  샘플 농협
                </div>
                <div style={{ 
                  fontSize: '32px', 
                  fontWeight: '800', 
                  marginBottom: '16px',
                  color: previewTemplate.accent_color || '#3b82f6'
                }}>
                  50,000원
                </div>
                <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                  홍길동 (12345)
                </div>
                <div style={{ fontSize: '14px', marginBottom: '16px' }}>
                  발행일: 2025-01-01
                </div>
                <div style={{
                  width: '80px',
                  height: '80px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: '#6b7280',
                  borderRadius: '8px'
                }}>
                  QR Code
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginTop: '12px',
                  fontFamily: 'monospace'
                }}>
                  2501010123456789
                </div>
              </div>
            </div>

            {/* Template Details */}
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '16px',
              borderRadius: '8px',
              fontSize: '14px'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <strong>배경색:</strong> {previewTemplate.background_color}
                </div>
                <div>
                  <strong>텍스트색:</strong> {previewTemplate.text_color}
                </div>
                <div>
                  <strong>강조색:</strong> {previewTemplate.accent_color}
                </div>
                <div>
                  <strong>폰트:</strong> {previewTemplate.font_family.split(',')[0]}
                </div>
                <div>
                  <strong>크기:</strong> {previewTemplate.width} × {previewTemplate.height}px
                </div>
                <div>
                  <strong>기본 템플릿:</strong> {previewTemplate.is_default ? '예' : '아니오'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
              <button
                onClick={closePreview}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Detail Modal */}
      {showBatchDetail && selectedBatch && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '90%',
            width: '800px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>
                배치 상세 정보: {selectedBatch.batch_name}
              </h3>
              <button
                onClick={closeBatchDetail}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ✕
              </button>
            </div>

            {/* Batch Info */}
            <div style={{ 
              backgroundColor: '#f9fafb', 
              padding: '16px', 
              borderRadius: '8px', 
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div><strong>템플릿:</strong> {selectedBatch.voucher_templates.voucher_name}</div>
                <div><strong>총 수량:</strong> {selectedBatch.total_count}개</div>
                <div><strong>상태:</strong> {selectedBatch.status === 'completed' ? '완료' : selectedBatch.status === 'failed' ? '실패' : '생성중'}</div>
                <div><strong>발행자:</strong> {selectedBatch.user_profiles.name}</div>
                <div><strong>생성일:</strong> {new Date(selectedBatch.created_at).toLocaleDateString('ko-KR')}</div>
                <div><strong>만료일:</strong> {new Date(selectedBatch.expires_at).toLocaleDateString('ko-KR')}</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button
                onClick={copyAllVoucherLinks}
                disabled={batchVouchers.length === 0}
                style={{
                  padding: '8px 16px',
                  backgroundColor: batchVouchers.length > 0 ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: batchVouchers.length > 0 ? 'pointer' : 'not-allowed',
                  fontSize: '14px'
                }}
              >
                📋 전체 링크 복사
              </button>
              <button
                onClick={() => copyLink(selectedBatch.link_token)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                📋 배치 링크 복사
              </button>
            </div>

            {/* Individual Vouchers */}
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                개별 교환권 목록 ({batchVouchers.length}개)
              </h4>
              
              {loadingBatchDetail ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  교환권 목록을 불러오는 중...
                </div>
              ) : batchVouchers.length > 0 ? (
                <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>이름</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>영농회</th>
                        <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>금액</th>
                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>상태</th>
                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>링크</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchVouchers.map((voucher) => (
                        <tr key={voucher.id}>
                          <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>
                            <div>{voucher.name}</div>
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              {voucher.member_id} • {voucher.serial_no}
                            </div>
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>
                            {voucher.association}
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                            {voucher.amount.toLocaleString()}원
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '10px',
                              fontSize: '12px',
                              backgroundColor: 
                                voucher.status === 'used' ? '#dcfce7' :
                                voucher.status === 'issued' ? '#dbeafe' : '#f3f4f6',
                              color:
                                voucher.status === 'used' ? '#166534' :
                                voucher.status === 'issued' ? '#1e40af' : '#6b7280'
                            }}>
                              {voucher.status === 'used' ? '사용됨' : 
                               voucher.status === 'issued' ? '발행됨' : voucher.status}
                            </span>
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                onClick={() => {
                                  const url = voucher.mobile_access_url || 
                                    `${window.location.origin}/mobile/vouchers/${voucher.mobile_link_token}`;
                                  navigator.clipboard.writeText(url);
                                  alert('원본 링크가 복사되었습니다.');
                                }}
                                disabled={!voucher.mobile_access_url && !voucher.mobile_link_token}
                                style={{
                                  padding: '4px 6px',
                                  backgroundColor: (voucher.mobile_access_url || voucher.mobile_link_token) ? '#6b7280' : '#e5e7eb',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: (voucher.mobile_access_url || voucher.mobile_link_token) ? 'pointer' : 'not-allowed',
                                  fontSize: '11px'
                                }}
                                title="원본 링크 복사"
                              >
                                원본
                              </button>
                              <button
                                onClick={() => copyVoucherLink(voucher)}
                                disabled={!voucher.mobile_access_url && !voucher.mobile_link_token}
                                style={{
                                  padding: '4px 6px',
                                  backgroundColor: (voucher.mobile_access_url || voucher.mobile_link_token) ? '#3b82f6' : '#9ca3af',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: (voucher.mobile_access_url || voucher.mobile_link_token) ? 'pointer' : 'not-allowed',
                                  fontSize: '11px'
                                }}
                                title="단축 링크 복사"
                              >
                                단축
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  교환권 데이터를 찾을 수 없습니다.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
              <button
                onClick={closeBatchDetail}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
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