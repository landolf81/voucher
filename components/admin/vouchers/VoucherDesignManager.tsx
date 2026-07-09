'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Mail, FileText, Smartphone, Rocket, Pencil, Trash2 } from 'lucide-react';

// 이메일 에디터는 클라이언트 사이드에서만 로드
const VoucherEmailEditor = dynamic(
  () => import('./VoucherEmailEditor').then(mod => mod.VoucherEmailEditor),
  {
    ssr: false,
    loading: () => (
      <div style={{ padding: '40px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        <Mail size={16} /> 이메일 에디터 로딩 중...
      </div>
    )
  }
);

interface DesignTemplate {
  id: string;
  name: string;
  description?: string;
  a4_image_url: string;
  a4_image_width: number;
  a4_image_height: number;
  mobile_image_url: string;
  mobile_image_size: number;
  a4_field_positions: Record<string, FieldPosition>;
  mobile_field_positions: Record<string, FieldPosition>;
  default_font_family: string;
  default_font_size: number;
  default_text_color: string;
  is_active: boolean;
  created_at: string;
  template_html?: string;
  template_css?: string;
  grapesjs_data?: any;
  mobile_template_html?: string;
  mobile_template_css?: string;
  mobile_grapesjs_data?: any;
}

interface FieldPosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
}

interface UploadedImage {
  url: string;
  fileName: string;
  imageType: 'a4' | 'mobile';
}

const AVAILABLE_FIELDS = [
  { key: 'association', label: '영농회', type: 'text' },
  { key: 'member_id', label: '조합원ID', type: 'text' },
  { key: 'name', label: '이름', type: 'text' },
  { key: 'dob', label: '생년월일', type: 'text' },
  { key: 'amount', label: '금액', type: 'text' },
  { key: 'serial_no', label: '일련번호', type: 'text' },
  { key: 'qr_code', label: 'QR코드', type: 'qr' },
  { key: 'barcode', label: '바코드', type: 'barcode' }
];

export function VoucherDesignManager() {
  const [templates, setTemplates] = useState<DesignTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DesignTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<DesignTemplate | null>(null);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // 폼 데이터 - 단순화
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    template_type: 'a4' as 'a4' | 'mobile',
    a4_image_url: '',
    mobile_image_url: '',
    a4_field_positions: {} as Record<string, any>,
    mobile_field_positions: {} as Record<string, any>,
    grapesjs_data: null as any,
    mobile_grapesjs_data: null as any,
    template_html: '',
    template_css: '',
    mobile_template_html: '',
    mobile_template_css: ''
  });
  const [uploadingImages, setUploadingImages] = useState<{ a4: boolean; mobile: boolean }>({
    a4: false,
    mobile: false
  });


  // 템플릿 목록 조회
  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/voucher-design-templates');
      const result = await response.json();
      
      if (result.success) {
        setTemplates(result.data);
      } else {
        setMessage({ type: 'error', text: result.message || '템플릿 조회에 실패했습니다.' });
      }
    } catch (error) {
      console.error('템플릿 조회 오류:', error);
      setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 별도 탭에서 에디터 열기
  const handleOpenEditor = (mode?: 'a4' | 'mobile', template?: DesignTemplate) => {
    let currentData = null;
    let detectedMode = mode;
    
    if (template) {
      // 편집 모드: 템플릿 타입 자동 감지
      if (!detectedMode) {
        detectedMode = template.template_html ? 'a4' : template.mobile_template_html ? 'mobile' : 'a4';
        console.log('템플릿 타입 자동 감지:', detectedMode);
      }
      
      if (detectedMode === 'a4') {
        currentData = template.grapesjs_data;
      } else {
        currentData = template.mobile_grapesjs_data || null;
      }
      // 상세한 데이터 분석
      const dataSize = currentData ? JSON.stringify(currentData).length : 0;
      const hasComplexStructure = currentData && JSON.stringify(currentData).includes('columns') && JSON.stringify(currentData).includes('cells');
      
      console.log('📊 편집 모드 데이터 분석:', {
        mode: detectedMode,
        templateId: template.id,
        hasData: !!currentData,
        dataSize: `${dataSize} characters`,
        hasComplexStructure,
        dataPreview: currentData ? JSON.stringify(currentData).substring(0, 200) + '...' : null
      });
      
      // 데이터 크기 경고
      if (dataSize > 8000) {
        console.warn(`⚠️ 큰 데이터 크기 감지: ${dataSize} characters. URL 길이 제한 문제 가능성`);
      }
      
      // 복잡한 구조 감지
      if (hasComplexStructure) {
        console.info('🔍 복잡한 컬럼 구조 감지: columns/cells 포함');
      }
      
      // grapesjs_data가 없는 경우 사용자에게 알림
      if (!currentData) {
        console.warn(`⚠️  ${detectedMode} 모드의 디자인 데이터가 없습니다. 새 디자인으로 시작합니다.`);
        alert(`이 템플릿은 ${detectedMode === 'a4' ? 'A4' : '모바일'} 디자인 데이터가 없습니다.\n새로운 디자인으로 시작하시겠습니까?`);
      }
    } else {
      // 신규 생성 모드: 선택된 타입 사용
      detectedMode = detectedMode || formData.template_type;
      console.log('신규 생성 모드 데이터:', { mode: detectedMode, hasData: false });
    }
    
    // 데이터 전달 방식 결정 (URL vs sessionStorage)
    let useSessionStorage = false;
    let sessionKey = '';
    
    if (currentData) {
      const dataSize = JSON.stringify(currentData).length;
      const encodedSize = encodeURIComponent(JSON.stringify(currentData)).length;
      
      // URL 길이가 2000자를 초과하면 sessionStorage 사용
      if (encodedSize > 2000) {
        useSessionStorage = true;
        sessionKey = `editor_data_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log('📦 sessionStorage 사용:', {
          reason: 'URL 길이 제한 초과',
          dataSize,
          encodedSize,
          sessionKey
        });
        
        // sessionStorage에 데이터 저장
        try {
          sessionStorage.setItem(sessionKey, JSON.stringify(currentData));
          console.log('✅ sessionStorage 저장 성공');
        } catch (error) {
          console.error('❌ sessionStorage 저장 실패:', error);
          alert('데이터가 너무 커서 저장할 수 없습니다. 더 단순한 디자인을 사용해주세요.');
          return;
        }
      }
    }
    
    // URL 파라미터 생성
    const params = new URLSearchParams({
      mode: detectedMode,
      ...(currentData && !useSessionStorage && { data: encodeURIComponent(JSON.stringify(currentData)) }),
      ...(useSessionStorage && { sessionKey }),
      ...(template && { templateId: template.id })
    });
    
    // URL 길이 최종 검증
    const fullUrl = `/editor?${params.toString()}`;
    console.log('🔗 에디터 URL 정보:', {
      urlLength: fullUrl.length,
      useSessionStorage,
      hasData: !!currentData,
      mode: detectedMode,
      sessionKey: useSessionStorage ? sessionKey : undefined
    });
    
    if (fullUrl.length > 8000) {
      console.error('❌ URL이 여전히 너무 깁니다:', fullUrl.length, 'characters');
      alert('템플릿 ID나 기타 데이터가 너무 깁니다. 관리자에게 문의해주세요.');
      return;
    }
    
    // 새 탭에서 에디터 열기
    const editorWindow = window.open(
      `/editor?${params.toString()}`,
      '_blank',
      'width=1400,height=1000,scrollbars=yes,resizable=yes'
    );

    if (editorWindow) {
      // 에디터에서 저장 메시지 수신 리스너
      const handleMessage = (event: MessageEvent) => {
        if (event.source === editorWindow && event.data.type === 'EDITOR_SAVE') {
          if (template) {
            handleEditTemplateSave(template.id, event.data.data, event.data.mode);
          } else {
            handleEmailEditorSave(event.data.data, event.data.mode);
          }
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);
    }
  };

  // 이메일 에디터 데이터 저장 핸들러 - 선택된 타입으로만 저장
  const handleEmailEditorSave = async (data: any, mode?: 'a4' | 'mobile') => {
    const saveMode = mode || formData.template_type;
    console.log('이메일 에디터 데이터 저장:', data, saveMode);
    
    // 템플릿 이름 (접미사 제거)
    const templateName = formData.name || '새 디자인';
    
    try {
      setLoading(true);
      
      // 선택된 타입으로만 저장
      const templateData: any = {
        name: templateName,
        description: formData.description || '',
        template_type: saveMode // 타입 정보 추가
      };
      
      // 선택된 타입에 따라 데이터 추가
      if (saveMode === 'a4') {
        templateData.template_html = data.html;
        templateData.template_css = data.css;
        templateData.grapesjs_data = data.design;
        templateData.a4_field_positions = extractFieldPositionsFromHtml(data.html);
      } else {
        templateData.mobile_template_html = data.html;
        templateData.mobile_template_css = data.css;
        templateData.mobile_grapesjs_data = data.design;
        templateData.mobile_field_positions = extractFieldPositionsFromHtml(data.html);
      }
      
      const response = await fetch('/api/voucher-design-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      });

      const result = await response.json();
      
      if (result.success) {
        // 미리보기 이미지 생성
        setTimeout(() => {
          generatePreviewImage(data.html, saveMode, result.data.id);
        }, 1000);
        
        setMessage({ type: 'success', text: `📧 ${saveMode === 'a4' ? 'A4' : '모바일'} 템플릿이 저장되었습니다.` });
        fetchTemplates(); // 목록 새로고침
        
        // 폼 리셋
        setFormData(prev => ({
          ...prev,
          name: '',
          description: '',
          template_type: 'a4'
        }));
        setShowCreateForm(false);
      } else {
        setMessage({ type: 'error', text: result.message || '템플릿 저장에 실패했습니다.' });
      }
    } catch (error) {
      console.error('템플릿 저장 오류:', error);
      setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 템플릿 편집 저장 핸들러
  const handleEditTemplateSave = async (templateId: string, data: any, mode?: 'a4' | 'mobile') => {
    const saveMode = mode || formData.template_type;
    console.log('템플릿 편집 저장:', templateId, data, saveMode);
    
    try {
      const updateData: any = {};
      
      if (saveMode === 'a4') {
        updateData.grapesjs_data = data.design;
        updateData.template_html = data.html;
        updateData.template_css = data.css;
        updateData.a4_field_positions = extractFieldPositionsFromHtml(data.html);
      } else {
        updateData.mobile_grapesjs_data = data.design;
        updateData.mobile_template_html = data.html;
        updateData.mobile_template_css = data.css;
        updateData.mobile_field_positions = extractFieldPositionsFromHtml(data.html);
      }

      const response = await fetch(`/api/voucher-design-templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: 'success', text: `✅ ${saveMode === 'a4' ? 'A4' : '모바일'} 템플릿이 업데이트되었습니다.` });
        fetchTemplates(); // 목록 새로고침
      } else {
        setMessage({ type: 'error', text: result.message || '템플릿 업데이트에 실패했습니다.' });
      }
    } catch (error) {
      console.error('템플릿 업데이트 오류:', error);
      setMessage({ type: 'error', text: '템플릿 업데이트 중 오류가 발생했습니다.' });
    }
  };

  // 템플릿 삭제 핸들러
  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm('정말로 이 디자인 템플릿을 삭제하시겠습니까?\n삭제된 템플릿은 복구할 수 없습니다.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/voucher-design-templates/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP Error:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: 'success', text: '✅ 디자인 템플릿이 삭제되었습니다.' });
        fetchTemplates(); // 목록 새로고침
      } else {
        setMessage({ type: 'error', text: result.message || '템플릿 삭제에 실패했습니다.' });
      }
    } catch (error) {
      console.error('템플릿 삭제 오류:', error);
      setMessage({ type: 'error', text: '템플릿 삭제 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // HTML에서 필드 위치 정보 추출 (기존 호환성 유지용)
  const extractFieldPositionsFromHtml = (html: string): Record<string, any> => {
    const fieldPositions: Record<string, any> = {};
    
    // data-field 속성을 가진 요소들 찾기
    const fieldRegex = /data-field="(\w+)"/g;
    let match;
    
    while ((match = fieldRegex.exec(html)) !== null) {
      const fieldName = match[1];
      fieldPositions[fieldName] = {
        x: 0,
        y: 0,
        width: 200,
        height: 50,
        style: {}
      };
    }
    
    return fieldPositions;
  };

  // 미리보기 이미지 생성 함수
  const generatePreviewImage = async (html: string, mode: 'a4' | 'mobile', templateId: string) => {
    try {
      console.log('미리보기 이미지 생성 시작:', { mode, templateId });
      
      // Canvas 기반 스크린샷 대신 간단한 썸네일 URL 생성
      const thumbnailData = {
        html: html.substring(0, 1000), // HTML 일부만 사용
        mode: mode,
        timestamp: Date.now()
      };
      
      // Base64 인코딩하여 데이터 URL 생성
      const dataUrl = `data:text/html;base64,${btoa(encodeURIComponent(JSON.stringify(thumbnailData)))}`;
      
      // 템플릿에 썸네일 URL 업데이트
      await fetch(`/api/voucher-design-templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [`${mode}_image_url`]: `/api/voucher-design-templates/${templateId}/preview?mode=${mode}`
        })
      });
      
      console.log('미리보기 URL 업데이트 완료');
      fetchTemplates(); // 목록 새로고침
      
    } catch (error) {
      console.error('미리보기 이미지 생성 실패:', error);
    }
  };

  // 이미지 업로드
  const handleImageUpload = async (file: File, type: 'a4' | 'mobile') => {
    setUploadingImages(prev => ({ ...prev, [type]: true }));
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const response = await fetch('/api/voucher-design-templates/upload-image', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (result.success) {
        setFormData(prev => ({
          ...prev,
          [`${type}_image_url`]: result.data.url
        }));
        setMessage({ type: 'success', text: `${type.toUpperCase()} 이미지가 업로드되었습니다.` });
      } else {
        setMessage({ type: 'error', text: result.message || '이미지 업로드에 실패했습니다.' });
      }
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      setMessage({ type: 'error', text: '이미지 업로드 중 오류가 발생했습니다.' });
    } finally {
      setUploadingImages(prev => ({ ...prev, [type]: false }));
    }
  };


  // 폼 제출 - 이제 사용되지 않음 (에디터에서 바로 저장)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setMessage({ type: 'error', text: 'A4 또는 모바일 디자인 에디터를 사용해서 디자인을 생성하고 저장해주세요.' });
    return;

    setLoading(true);
    try {
      const response = await fetch('/api/voucher-design-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          a4_image_url: formData.a4_image_url,
          mobile_image_url: formData.mobile_image_url,
          a4_field_positions: formData.a4_field_positions,
          mobile_field_positions: formData.mobile_field_positions,
          template_html: formData.template_html,
          template_css: formData.template_css,
          grapesjs_data: formData.grapesjs_data
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: 'success', text: '디자인 템플릿이 생성되었습니다.' });
        setShowCreateForm(false);
        setFormData({
          name: '',
          description: '',
          template_type: 'a4',
          a4_image_url: '',
          mobile_image_url: '',
          a4_field_positions: {},
          mobile_field_positions: {},
          grapesjs_data: null,
          mobile_grapesjs_data: null,
          template_html: '',
          template_css: '',
          mobile_template_html: '',
          mobile_template_css: ''
        });
        fetchTemplates();
      } else {
        setMessage({ type: 'error', text: result.message || '디자인 템플릿 생성에 실패했습니다.' });
      }
    } catch (error) {
      console.error('디자인 템플릿 생성 오류:', error);
      setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);


  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1a202c', margin: 0 }}>
          교환권 디자인 관리
        </h3>
        <button
          onClick={() => setShowCreateForm(true)}
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
          + 새 디자인 템플릿
        </button>
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

      {/* 디자인 템플릿 생성 폼 */}
      {showCreateForm && (
        <div style={{
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1a202c', margin: 0 }}>
              새 디자인 템플릿 생성
            </h4>
            <button
              onClick={() => setShowCreateForm(false)}
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

          <form onSubmit={handleSubmit}>
            {/* 기본 정보 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  템플릿 이름 *
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
                  placeholder="예: 성주사과농협 기본 템플릿"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  설명
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="템플릿 설명"
                />
              </div>

              {/* 템플릿 타입 선택 */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                  템플릿 타입 *
                </label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="template_type"
                      value="a4"
                      checked={formData.template_type === 'a4'}
                      onChange={(e) => setFormData(prev => ({ ...prev, template_type: e.target.value as 'a4' | 'mobile' }))}
                      style={{ marginRight: '8px' }}
                    />
                    <span style={{ fontSize: '14px', color: '#374151', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><FileText size={14} /> A4 (210×297mm)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="template_type"
                      value="mobile"
                      checked={formData.template_type === 'mobile'}
                      onChange={(e) => setFormData(prev => ({ ...prev, template_type: e.target.value as 'a4' | 'mobile' }))}
                      style={{ marginRight: '8px' }}
                    />
                    <span style={{ fontSize: '14px', color: '#374151', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Smartphone size={14} /> 모바일 (400×600px)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 디자인 에디터 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {formData.template_type === 'a4' ? (<><FileText size={16} /> A4</>) : (<><Smartphone size={16} /> 모바일</>)} 디자인 에디터
                </h5>
                
                {/* 에디터 열기 버튼 */}
                <button
                  type="button"
                  onClick={() => handleOpenEditor(formData.template_type)}
                  style={{
                    backgroundColor: '#0ea5e9',
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
                  <Rocket size={16} /> 에디터 열기
                </button>
              </div>

              <div style={{ 
                padding: '16px', 
                backgroundColor: '#f0f9ff', 
                border: '1px solid #0ea5e9',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <p style={{ margin: 0, color: '#0c4a6e', fontSize: '14px' }}>
                  선택한 템플릿 타입({formData.template_type === 'a4' ? 'A4' : '모바일'})으로 디자인을 생성하세요. 
                  에디터에서 디자인을 완료하고 저장하면 자동으로 템플릿이 생성됩니다.
                </p>
              </div>
            </div>

            {/* 폼 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
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
                취소
              </button>
              <button
                type="submit"
                disabled={loading || !formData.name}
                style={{
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: (loading || !formData.name) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: (loading || !formData.name) ? 0.6 : 1
                }}
              >
                {loading ? '생성 중...' : '디자인 템플릿 생성'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 디자인 템플릿 목록 */}
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
          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1a202c', margin: 0 }}>
            디자인 템플릿 목록
          </h4>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            데이터를 불러오는 중...
          </div>
        ) : templates.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            등록된 디자인 템플릿이 없습니다.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    템플릿 이름
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    설명
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    타입
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    미리보기
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    상태
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                    생성일
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb', width: '120px' }}>
                    관리
                  </th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: '500' }}>
                      {template.name}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                      {template.description || '-'}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      {/* 템플릿 타입 표시 */}
                      {template.template_html && template.mobile_template_html ? (
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>둘 다</span>
                      ) : template.template_html ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '500',
                          backgroundColor: '#dbeafe',
                          color: '#1d4ed8'
                        }}>
                          <FileText size={12} /> A4
                        </span>
                      ) : template.mobile_template_html ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '500',
                          backgroundColor: '#dcfce7',
                          color: '#16a34a'
                        }}>
                          <Smartphone size={12} /> 모바일
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      {/* 단일 미리보기 */}
                      {template.a4_image_url ? (
                        <Image
                          src={template.a4_image_url}
                          alt="미리보기"
                          width={50}
                          height={65}
                          unoptimized
                          style={{ width: '50px', height: '65px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e5e7eb' }}
                        />
                      ) : template.mobile_image_url ? (
                        <Image
                          src={template.mobile_image_url}
                          alt="미리보기"
                          width={45}
                          height={65}
                          unoptimized
                          style={{ width: '45px', height: '65px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e5e7eb' }}
                        />
                      ) : template.template_html || template.mobile_template_html ? (
                        <div style={{ width: '50px', height: '65px', backgroundColor: '#f3f4f6', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                          {template.template_html ? <FileText size={16} /> : <Smartphone size={16} />}
                        </div>
                      ) : (
                        <div style={{ width: '50px', height: '65px', backgroundColor: '#f9fafb', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#9ca3af' }}>
                          없음
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: template.is_active ? '#dcfce7' : '#f3f4f6',
                        color: template.is_active ? '#16a34a' : '#6b7280'
                      }}>
                        {template.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280' }}>
                      {new Date(template.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleOpenEditor(undefined, template)}
                          style={{
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="디자인 편집"
                        >
                          <Pencil size={12} /> 편집
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          disabled={loading}
                          style={{
                            backgroundColor: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '11px',
                            opacity: loading ? 0.6 : 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="템플릿 삭제"
                        >
                          <Trash2 size={12} /> 삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}