'use client';

import React, { useEffect, useRef, useState } from 'react';
import grapesjs, { Editor } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';

interface SimpleGrapesJSEditorProps {
  templateId?: string;
  onSave?: (data: any) => void;
  initialData?: any;
  imageUrl?: string;
}

export function SimpleGrapesJSEditor({ 
  templateId, 
  onSave, 
  initialData,
  imageUrl 
}: SimpleGrapesJSEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!editorRef.current) return;

    // GrapesJS 기본 UI로 초기화
    const gjsEditor = grapesjs.init({
      container: editorRef.current,
      fromElement: true,
      height: '100vh',
      width: 'auto',
      storageManager: false,
      
      // 기본 패널들 활성화
      panels: { 
        defaults: [
          {
            id: 'layers',
            el: '#layer-manager',
            resizable: {
              maxDim: 350,
              minDim: 200,
              tc: false,
              cl: true,
              cr: false,
              bc: false,
              keyWidth: 'flex-basis',
            },
          },
          {
            id: 'styles',
            el: '#style-manager',
            resizable: {
              maxDim: 350,
              minDim: 200,
              tc: false,
              cl: true,
              cr: false,
              bc: false,
              keyWidth: 'flex-basis',
            },
          },
          {
            id: 'traits',
            el: '#trait-manager',
            resizable: {
              maxDim: 350,
              minDim: 200,
              tc: false,
              cl: true,
              cr: false,
              bc: false,
              keyWidth: 'flex-basis',
            },
          },
        ]
      },
      
      // 한국어 지원 폰트
      canvas: {
        styles: [
          'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap'
        ]
      },

      // 교환권 전용 블록 추가
      blockManager: {
        appendTo: '#blocks',
        blocks: [
          {
            id: 'association',
            label: '영농회',
            content: '<div data-field="association" style="padding: 10px; border: 2px dashed #3b82f6; background: #e0f2fe; text-align: center; margin: 5px;">영농회명</div>',
            category: '교환권 필드',
            attributes: { class: 'fa fa-building' }
          },
          {
            id: 'member_id',
            label: '조합원ID',
            content: '<div data-field="member_id" style="padding: 8px; border: 2px dashed #10b981; background: #f0fdf4; text-align: center; margin: 5px;">조합원ID</div>',
            category: '교환권 필드',
            attributes: { class: 'fa fa-id-card' }
          },
          {
            id: 'name',
            label: '이름',
            content: '<div data-field="name" style="padding: 10px; border: 2px dashed #f59e0b; background: #fefce8; text-align: center; margin: 5px; font-weight: bold;">이름</div>',
            category: '교환권 필드',
            attributes: { class: 'fa fa-user' }
          },
          {
            id: 'dob',
            label: '생년월일',
            content: '<div data-field="dob" style="padding: 8px; border: 2px dashed #8b5cf6; background: #f8fafc; text-align: center; margin: 5px;">생년월일</div>',
            category: '교환권 필드',
            attributes: { class: 'fa fa-calendar' }
          },
          {
            id: 'amount',
            label: '금액',
            content: '<div data-field="amount" style="padding: 12px; border: 3px dashed #059669; background: #f0fdf4; text-align: center; margin: 5px; font-weight: bold; color: #059669; font-size: 18px;">금액</div>',
            category: '교환권 필드',
            attributes: { class: 'fa fa-won-sign' }
          },
          {
            id: 'serial_no',
            label: '일련번호',
            content: '<div data-field="serial_no" style="padding: 6px; border: 2px dashed #6b7280; background: #f9fafb; text-align: center; margin: 5px; font-family: monospace; font-size: 12px;">일련번호</div>',
            category: '교환권 필드',
            attributes: { class: 'fa fa-barcode' }
          },
          {
            id: 'qr_code',
            label: 'QR 코드',
            content: '<div data-field="qr_code" style="width: 80px; height: 80px; border: 2px dashed #666; background: #f9fafb; text-align: center; line-height: 80px; margin: 5px;">QR</div>',
            category: '교환권 필드',
            attributes: { class: 'fa fa-qrcode' }
          },
          {
            id: 'barcode',
            label: '바코드',
            content: '<div data-field="barcode" style="width: 120px; height: 30px; border: 2px dashed #7c3aed; background: #faf5ff; text-align: center; line-height: 30px; margin: 5px; font-size: 10px;">BARCODE</div>',
            category: '교환권 필드',
            attributes: { class: 'fa fa-barcode' }
          }
        ]
      },

      // 디바이스 설정
      deviceManager: {
        devices: [
          {
            name: 'Desktop',
            width: '',
          },
          {
            name: 'A4 세로',
            width: '595px',
            height: '842px'
          },
          {
            name: 'A4 가로',
            width: '842px', 
            height: '595px'
          },
          {
            name: 'Mobile',
            width: '400px',
            height: '600px'
          }
        ]
      }
    });

    // 초기 데이터 로드
    if (initialData) {
      gjsEditor.loadProjectData(initialData);
    }

    // 배경 이미지 설정
    if (imageUrl) {
      const wrapper = gjsEditor.getWrapper();
      wrapper?.setStyle({
        'background-image': `url(${imageUrl})`,
        'background-size': 'cover',
        'background-position': 'center',
        'background-repeat': 'no-repeat',
      });
    }

    setEditor(gjsEditor);
    setIsLoading(false);

    // 클린업
    return () => {
      gjsEditor.destroy();
    };
  }, [imageUrl, initialData]);

  const handleSave = () => {
    if (!editor) return;

    const html = editor.getHtml();
    const css = editor.getCss();
    const json = editor.getProjectData();
    const components = editor.getComponents().toJSON();

    if (onSave) {
      onSave({
        html,
        css,
        json,
        components
      });
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 1000, background: 'white' }}>
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }}></div>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: '500', color: '#374151' }}>
            🎨 디자인 에디터 로딩 중...
          </p>
        </div>
      )}

      {/* 상단 툴바 */}
      <div style={{
        height: '60px',
        backgroundColor: '#1f2937',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        borderBottom: '1px solid #374151'
      }}>
        <h2 style={{ color: 'white', margin: 0, fontSize: '18px' }}>교환권 디자인 에디터</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleSave}
            style={{
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            💾 저장
          </button>
          <button
            onClick={() => window.close()}
            style={{
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ✕ 닫기
          </button>
        </div>
      </div>

      {/* GrapesJS 에디터 영역 */}
      <div style={{ height: 'calc(100vh - 60px)', display: 'flex' }}>
        {/* 블록 패널 */}
        <div id="blocks" style={{
          width: '250px',
          backgroundColor: '#f9fafb',
          borderRight: '1px solid #e5e7eb',
          overflow: 'auto'
        }}></div>

        {/* 메인 에디터 */}
        <div ref={editorRef} style={{ flex: 1 }}></div>

        {/* 속성 패널 */}
        <div style={{
          width: '300px',
          backgroundColor: '#f9fafb',
          borderLeft: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div id="style-manager" style={{ flex: 1, overflow: 'auto', padding: '10px' }}></div>
          <div id="trait-manager" style={{ minHeight: '200px', borderTop: '1px solid #e5e7eb', padding: '10px' }}></div>
          <div id="layer-manager" style={{ minHeight: '200px', borderTop: '1px solid #e5e7eb', padding: '10px' }}></div>
        </div>
      </div>
    </div>
  );
}