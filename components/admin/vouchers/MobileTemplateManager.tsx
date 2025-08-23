'use client';

/**
 * Mobile Template Manager Component
 * Manages mobile voucher design templates
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';

interface VoucherTemplate {
  id: string;
  voucher_name: string;
  voucher_type: string;
  status: string;
}

interface MobileDesignTemplate {
  id: string;
  template_id: string;
  name: string;
  description: string;
  background_color: string;
  text_color: string;
  accent_color: string;
  font_family: string;
  width: number;
  height: number;
  background_image_url?: string;
  qr_background_image?: string;
  field_positions: any;
  template_config: any;
  status: string;
  is_default: boolean;
}

export function MobileTemplateManager() {
  const { user } = useAuth();
  const [voucherTemplates, setVoucherTemplates] = useState<VoucherTemplate[]>([]);
  const [mobileTemplates, setMobileTemplates] = useState<MobileDesignTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [editingTemplate, setEditingTemplate] = useState<MobileDesignTemplate | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state for template editing
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    background_color: '#ffffff',
    text_color: '#1f2937',
    accent_color: '#3b82f6',
    font_family: 'Pretendard, sans-serif',
    width: 400,
    height: 400,
    background_image_url: '',
    qr_background_image: '',
    template_config: {
      showBorder: true,
      showShadow: true,
      gradientBackground: false,
      showLogo: false,
      borderRadius: 12,
      padding: 20,
      customTexts: {
        title: '교환권',
        subtitle: '',
        footer: '',
        watermark: ''
      }
    }
  });

  // Load data on mount
  useEffect(() => {
    loadVoucherTemplates();
    loadMobileTemplates();
  }, []);

  const loadVoucherTemplates = async () => {
    try {
      const response = await fetch('/api/voucher-templates');
      if (response.ok) {
        const data = await response.json();
        setVoucherTemplates(data.data || []);
      }
    } catch (error) {
      console.error('교환권 템플릿 로드 오류:', error);
    }
  };

  const loadMobileTemplates = async () => {
    try {
      const response = await fetch('/api/mobile-templates');
      if (response.ok) {
        const data = await response.json();
        setMobileTemplates(data.data || []);
      }
    } catch (error) {
      console.error('모바일 템플릿 로드 오류:', error);
    }
  };

  const handleCreateTemplate = async () => {
    if (!selectedTemplate) {
      alert('교환권 템플릿을 선택해주세요.');
      return;
    }

    const existingTemplate = mobileTemplates.find(mt => mt.template_id === selectedTemplate);
    if (existingTemplate) {
      setEditingTemplate(existingTemplate);
      setFormData({
        name: existingTemplate.name,
        description: existingTemplate.description,
        background_color: existingTemplate.background_color,
        text_color: existingTemplate.text_color,
        accent_color: existingTemplate.accent_color,
        font_family: existingTemplate.font_family,
        width: existingTemplate.width,
        height: existingTemplate.height,
        background_image_url: existingTemplate.background_image_url || '',
        qr_background_image: existingTemplate.qr_background_image || '',
        template_config: {
          showBorder: true,
          showShadow: true,
          gradientBackground: false,
          showLogo: false,
          borderRadius: 12,
          padding: 20,
          customTexts: {
            title: '교환권',
            subtitle: '',
            footer: '',
            watermark: ''
          },
          ...existingTemplate.template_config
        }
      });
    } else {
      setEditingTemplate(null);
      const voucherTemplate = voucherTemplates.find(vt => vt.id === selectedTemplate);
      setFormData({
        name: `${voucherTemplate?.voucher_name} 모바일 디자인`,
        description: `${voucherTemplate?.voucher_name}의 모바일 교환권 디자인`,
        background_color: '#ffffff',
        text_color: '#1f2937',
        accent_color: '#3b82f6',
        font_family: 'Pretendard, sans-serif',
        width: 400,
        height: 400,
        background_image_url: '',
        qr_background_image: '',
        template_config: {
          showBorder: true,
          showShadow: true,
          gradientBackground: false,
          showLogo: false,
          borderRadius: 12,
          padding: 20,
          customTexts: {
            title: '교환권',
            subtitle: '',
            footer: '',
            watermark: ''
          }
        }
      });
    }
    setShowEditor(true);
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;

    setLoading(true);
    try {
      const requestData = {
        template_id: selectedTemplate,
        ...formData
      };

      const response = await fetch('/api/mobile-templates', {
        method: editingTemplate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTemplate ? { ...requestData, id: editingTemplate.id } : requestData)
      });

      if (response.ok) {
        alert(editingTemplate ? '템플릿이 수정되었습니다.' : '템플릿이 생성되었습니다.');
        setShowEditor(false);
        loadMobileTemplates();
      } else {
        const error = await response.json();
        alert(`저장 실패: ${error.message}`);
      }
    } catch (error) {
      console.error('템플릿 저장 오류:', error);
      alert('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('정말로 이 모바일 템플릿을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/mobile-templates/${templateId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert('템플릿이 삭제되었습니다.');
        loadMobileTemplates();
      } else {
        const error = await response.json();
        alert(`삭제 실패: ${error.message}`);
      }
    } catch (error) {
      console.error('템플릿 삭제 오류:', error);
      alert('서버 오류가 발생했습니다.');
    }
  };

  const renderPreview = () => {
    return (
      <div 
        style={{
          width: formData.width,
          height: formData.height,
          backgroundColor: formData.background_color,
          color: formData.text_color,
          fontFamily: formData.font_family,
          position: 'relative',
          border: formData.template_config.showBorder ? '1px solid #e5e7eb' : 'none',
          borderRadius: `${formData.template_config.borderRadius || 12}px`,
          boxShadow: formData.template_config.showShadow ? '0 4px 6px rgba(0,0,0,0.1)' : 'none',
          background: formData.template_config.gradientBackground 
            ? `linear-gradient(135deg, ${formData.background_color}, ${formData.accent_color})`
            : formData.background_color,
          backgroundImage: formData.background_image_url ? `url(${formData.background_image_url})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${formData.template_config.padding || 20}px`,
          margin: '0 auto',
          overflow: 'hidden'
        }}
      >
        {formData.template_config.showLogo && (
          <div style={{
            width: '40px',
            height: '40px',
            backgroundColor: 'rgba(255,255,255,0.8)',
            border: '1px solid #e5e7eb',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            marginBottom: '12px'
          }}>
            🏢
          </div>
        )}
        <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
          {formData.template_config.customTexts.title || '교환권'}
        </div>
        <div style={{ fontSize: '14px', marginBottom: '20px', opacity: 0.7 }}>
          {formData.template_config.customTexts.subtitle || '영농회명'}
        </div>
        <div style={{ 
          fontSize: '36px', 
          fontWeight: '800', 
          color: formData.accent_color,
          marginBottom: '20px' 
        }}>
          50,000원
        </div>
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.9)',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '16px',
          color: '#374151',
          fontWeight: '500'
        }}>
          <div style={{ marginBottom: '6px' }}>성명: 홍길동</div>
          <div style={{ marginBottom: '6px' }}>회원번호: M001</div>
          <div>발행일: {new Date().toLocaleDateString('ko-KR')}</div>
        </div>
        <div style={{
          width: '80px',
          height: '80px',
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          marginBottom: '12px',
          backgroundImage: formData.qr_background_image ? `url(${formData.qr_background_image})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: formData.qr_background_image ? 'white' : '#374151',
          textShadow: formData.qr_background_image ? '0 0 3px rgba(0,0,0,0.8)' : 'none',
          fontWeight: 'bold'
        }}>
          QR
        </div>
        <div style={{ fontSize: '12px', fontFamily: 'monospace', opacity: 0.6, marginBottom: '8px' }}>
          240101000001
        </div>
        {formData.template_config.customTexts?.footer && (
          <div style={{ 
            fontSize: '11px', 
            color: formData.text_color, 
            opacity: 0.8, 
            textAlign: 'center',
            marginTop: '8px',
            padding: '4px 8px',
            backgroundColor: 'rgba(255,255,255,0.7)',
            borderRadius: '4px'
          }}>
            {formData.template_config.customTexts.footer}
          </div>
        )}
        {formData.template_config.customTexts?.watermark && (
          <div style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            fontSize: '8px',
            color: formData.text_color,
            opacity: 0.3,
            transform: 'rotate(-15deg)',
            fontWeight: 'bold'
          }}>
            {formData.template_config.customTexts.watermark}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <h3 style={{
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#1a202c',
        marginBottom: '24px'
      }}>
        📱 모바일 템플릿 관리
      </h3>

      {!showEditor ? (
        <div>
          {/* Template Selection */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                marginBottom: '8px', 
                color: '#374151' 
              }}>
                교환권 템플릿 선택
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                style={{
                  width: '300px',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              >
                <option value="">템플릿 선택</option>
                {voucherTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.voucher_name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleCreateTemplate}
              disabled={!selectedTemplate}
              style={{
                padding: '12px 24px',
                backgroundColor: selectedTemplate ? '#3b82f6' : '#9ca3af',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: selectedTemplate ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              🎨 모바일 디자인 템플릿 편집
            </button>
          </div>

          {/* Existing Templates */}
          <div style={{ marginBottom: '32px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>
              기존 모바일 템플릿 ({mobileTemplates.length}개)
            </h4>

            {mobileTemplates.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {mobileTemplates.map((template) => {
                  const voucherTemplate = voucherTemplates.find(vt => vt.id === template.template_id);
                  return (
                    <div key={template.id} style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '16px',
                      backgroundColor: 'white'
                    }}>
                      <div style={{ marginBottom: '12px' }}>
                        <h5 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                          {template.name}
                        </h5>
                        <p style={{ fontSize: '14px', color: '#6b7280' }}>
                          {voucherTemplate?.voucher_name} • {template.status}
                        </p>
                      </div>
                      
                      <div style={{ marginBottom: '12px', fontSize: '14px' }}>
                        <div>크기: {template.width} × {template.height}px</div>
                        <div>배경: {template.background_color}</div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setSelectedTemplate(template.template_id);
                            setEditingTemplate(template);
                            setFormData({
                              name: template.name,
                              description: template.description,
                              background_color: template.background_color,
                              text_color: template.text_color,
                              accent_color: template.accent_color,
                              font_family: template.font_family,
                              width: template.width,
                              height: template.height,
                              background_image_url: template.background_image_url || '',
                              qr_background_image: template.qr_background_image || '',
                              template_config: {
                                showBorder: true,
                                showShadow: true,
                                gradientBackground: false,
                                showLogo: false,
                                borderRadius: 12,
                                padding: 20,
                                customTexts: {
                                  title: '교환권',
                                  subtitle: '',
                                  footer: '',
                                  watermark: ''
                                },
                                ...template.template_config
                              }
                            });
                            setShowEditor(true);
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          편집
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#9ca3af',
                border: '2px dashed #d1d5db',
                borderRadius: '8px'
              }}>
                <p>생성된 모바일 템플릿이 없습니다.</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                  교환권 템플릿을 선택하고 모바일 디자인을 만들어보세요.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Template Editor */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Editor Panel */}
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              템플릿 편집
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                  템플릿 이름
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                  설명
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', height: '60px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                    배경색
                  </label>
                  <input
                    type="color"
                    value={formData.background_color}
                    onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                    style={{ width: '100%', height: '40px', border: 'none', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                    글자색
                  </label>
                  <input
                    type="color"
                    value={formData.text_color}
                    onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                    style={{ width: '100%', height: '40px', border: 'none', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                  강조색
                </label>
                <input
                  type="color"
                  value={formData.accent_color}
                  onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                  style={{ width: '100%', height: '40px', border: 'none', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                  폰트 패밀리
                </label>
                <select
                  value={formData.font_family}
                  onChange={(e) => setFormData({ ...formData, font_family: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="Pretendard, sans-serif">Pretendard (기본)</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="'Times New Roman', serif">Times New Roman</option>
                  <option value="'Courier New', monospace">Courier New</option>
                  <option value="Verdana, sans-serif">Verdana</option>
                  <option value="Helvetica, sans-serif">Helvetica</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                    너비 (px)
                  </label>
                  <input
                    type="number"
                    min="200"
                    max="800"
                    value={formData.width}
                    onChange={(e) => setFormData({ ...formData, width: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                    높이 (px)
                  </label>
                  <input
                    type="number"
                    min="200"
                    max="800"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                  배경 이미지 URL (선택사항)
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/background.jpg"
                  value={formData.background_image_url}
                  onChange={(e) => setFormData({ ...formData, background_image_url: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                  QR코드 배경 이미지 URL (선택사항)
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/qr-background.jpg"
                  value={formData.qr_background_image}
                  onChange={(e) => setFormData({ ...formData, qr_background_image: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                />
              </div>

              {/* Text Customization Section */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                  문구 커스터마이징
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      제목 텍스트
                    </label>
                    <input
                      type="text"
                      placeholder="교환권"
                      value={formData.template_config.customTexts?.title || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        template_config: {
                          ...formData.template_config,
                          customTexts: {
                            ...formData.template_config.customTexts,
                            title: e.target.value
                          }
                        }
                      })}
                      style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      부제목 텍스트
                    </label>
                    <input
                      type="text"
                      placeholder="영농회명"
                      value={formData.template_config.customTexts?.subtitle || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        template_config: {
                          ...formData.template_config,
                          customTexts: {
                            ...formData.template_config.customTexts,
                            subtitle: e.target.value
                          }
                        }
                      })}
                      style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      푸터 텍스트
                    </label>
                    <input
                      type="text"
                      placeholder="하단 안내 문구"
                      value={formData.template_config.customTexts?.footer || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        template_config: {
                          ...formData.template_config,
                          customTexts: {
                            ...formData.template_config.customTexts,
                            footer: e.target.value
                          }
                        }
                      })}
                      style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      워터마크 텍스트
                    </label>
                    <input
                      type="text"
                      placeholder="워터마크"
                      value={formData.template_config.customTexts?.watermark || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        template_config: {
                          ...formData.template_config,
                          customTexts: {
                            ...formData.template_config.customTexts,
                            watermark: e.target.value
                          }
                        }
                      })}
                      style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                  디자인 옵션
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={formData.template_config.showBorder}
                      onChange={(e) => setFormData({
                        ...formData,
                        template_config: { ...formData.template_config, showBorder: e.target.checked }
                      })}
                      style={{ marginRight: '8px' }}
                    />
                    테두리 표시
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={formData.template_config.showShadow}
                      onChange={(e) => setFormData({
                        ...formData,
                        template_config: { ...formData.template_config, showShadow: e.target.checked }
                      })}
                      style={{ marginRight: '8px' }}
                    />
                    그림자 효과
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={formData.template_config.gradientBackground}
                      onChange={(e) => setFormData({
                        ...formData,
                        template_config: { ...formData.template_config, gradientBackground: e.target.checked }
                      })}
                      style={{ marginRight: '8px' }}
                    />
                    그라데이션 배경
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={formData.template_config.showLogo}
                      onChange={(e) => setFormData({
                        ...formData,
                        template_config: { ...formData.template_config, showLogo: e.target.checked }
                      })}
                      style={{ marginRight: '8px' }}
                    />
                    로고 표시
                  </label>
                </div>
              </div>

              {/* Advanced Layout Options */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                  레이아웃 설정
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      모서리 반지름 (px)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={formData.template_config.borderRadius || 12}
                      onChange={(e) => setFormData({
                        ...formData,
                        template_config: { ...formData.template_config, borderRadius: Number(e.target.value) }
                      })}
                      style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      내부 여백 (px)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="50"
                      value={formData.template_config.padding || 20}
                      onChange={(e) => setFormData({
                        ...formData,
                        template_config: { ...formData.template_config, padding: Number(e.target.value) }
                      })}
                      style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <button
                onClick={handleSaveTemplate}
                disabled={loading}
                style={{
                  padding: '12px 24px',
                  backgroundColor: loading ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {loading ? '저장 중...' : '💾 저장'}
              </button>
              <button
                onClick={() => setShowEditor(false)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                취소
              </button>
            </div>
          </div>

          {/* Preview Panel */}
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              미리보기
            </h4>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
              {renderPreview()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}