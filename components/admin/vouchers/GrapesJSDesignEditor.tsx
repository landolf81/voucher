'use client';

import React, { useEffect, useRef, useState } from 'react';
import grapesjs, { Editor } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import '@/styles/grapesjs-custom.css';

interface GrapesJSDesignEditorProps {
  templateId?: string;
  onSave?: (data: any) => void;
  initialData?: any;
  imageUrl?: string;
}

export function GrapesJSDesignEditor({ 
  templateId, 
  onSave, 
  initialData,
  imageUrl 
}: GrapesJSDesignEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!editorRef.current) return;

    // GrapesJS 에디터 초기화
    const gjsEditor = grapesjs.init({
      container: editorRef.current,
      width: 'auto',
      height: '560px',
      storageManager: false,
      noticeOnUnload: false,
      
      // 드래그 앤 드롭 개선
      dragMode: 'absolute',
      
      // 캔버스 강제 새로고침 설정
      forceClass: false,
      
      // 컴포넌트 기본 설정
      domComponents: {
        processor(obj: any) {
          if (obj.tagName) {
            obj.tagName = obj.tagName.toLowerCase();
          }
          return obj;
        }
      },
      
      // 선택 도구 개선
      selectorManager: {
        appendTo: '.styles-container'
      },
      
      // 디바이스 설정 (A4 세로/가로, 모바일)
      deviceManager: {
        devices: [
          {
            name: 'A4 세로',
            width: '595px', // A4 width in pixels at 72 DPI
            height: '842px'
          },
          {
            name: 'A4 가로',
            width: '842px', // A4 landscape
            height: '595px'
          },
          {
            name: 'Mobile',
            width: '400px',
            height: '400px'
          }
        ]
      },

      // 캔버스 설정
      canvas: {
        styles: [
          'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap',
          // 인라인 CSS로 컴포넌트 기본 스타일 보장
          `
          * { box-sizing: border-box; }
          [data-gjs-type] { 
            visibility: visible !important; 
            display: block !important; 
            opacity: 1 !important;
          }
          [data-field] {
            visibility: visible !important;
            display: block !important;
            opacity: 1 !important;
            position: relative !important;
            z-index: 1 !important;
          }
          body { margin: 0; padding: 0; }
          `
        ],
        scripts: [],
        customBadgeLabel: () => ''
      },


      // 레이어 매니저
      layerManager: {
        appendTo: '.layers-container'
      },
      
      // 트레이트 매니저 (속성 패널)
      traitManager: {
        appendTo: '.traits-container'
      },
      
      // 스타일 매니저를 오른쪽 패널에 표시
      styleManager: {
        appendTo: '.styles-container',
        sectors: [
          {
            name: '위치',
            open: true,
            properties: [
              'position',
              'top',
              'right',
              'left',
              'bottom'
            ]
          },
          {
            name: '크기',
            open: true,
            properties: [
              'width',
              'height',
              'min-width',
              'min-height',
              'margin',
              'padding'
            ]
          },
          {
            name: '텍스트',
            open: false,
            properties: [
              'font-family',
              'font-size',
              'font-weight',
              'text-align',
              'color',
              'line-height'
            ]
          },
          {
            name: '배경 & 테두리',
            open: false,
            properties: [
              'background-color',
              'background',
              'border',
              'border-radius',
              'box-shadow'
            ]
          }
        ]
      },

      // 패널 설정 - 기본 패널 비활성화
      panels: {
        defaults: []
      },

      // 블록 매니저 - 교환권 전용 블록
      blockManager: {
        appendTo: '.blocks-container',
        blocks: [
          // 테스트용 간단한 블록
          {
            id: 'test-block',
            label: '🔴 테스트',
            content: `<div style="width: 100px; height: 50px; background-color: red; color: white; display: block; text-align: center; line-height: 50px; margin: 10px; border: 2px solid black;">TEST</div>`,
            category: '테스트',
            attributes: { class: 'fa fa-square' }
          },
          {
            id: 'association',
            label: '영농회',
            content: `<div data-gjs-type="text" data-field="association" style="display: block !important; visibility: visible !important; opacity: 1 !important; font-size: 16px; font-weight: bold; padding: 8px 12px; border: 2px solid #3b82f6; min-width: 100px; min-height: 30px; text-align: center; background-color: #e0f2fe; border-radius: 4px; margin: 10px; position: relative; z-index: 1;">영농회명</div>`,
            category: '교환권 필드',
            attributes: { class: 'fa fa-building' }
          },
          {
            id: 'member_id',
            label: '조합원ID',
            content: `<div data-gjs-type="text" data-field="member_id" style="display: block; font-size: 14px; padding: 6px 10px; border: 2px dashed #10b981; min-width: 80px; min-height: 25px; text-align: center; background-color: rgba(16, 185, 129, 0.05); border-radius: 4px; margin: 10px;">조합원ID</div>`,
            category: '교환권 필드',
            attributes: { class: 'fa fa-id-card' }
          },
          {
            id: 'name',
            label: '이름',
            content: `<div data-gjs-type="text" data-field="name" style="display: block; font-size: 18px; font-weight: bold; padding: 8px 12px; border: 2px dashed #f59e0b; min-width: 60px; min-height: 32px; text-align: center; background-color: rgba(245, 158, 11, 0.05); border-radius: 4px; margin: 10px;">이름</div>`,
            category: '교환권 필드',
            attributes: { class: 'fa fa-user' }
          },
          {
            id: 'dob',
            label: '생년월일',
            content: `<div data-gjs-type="text" data-field="dob" style="display: block; font-size: 14px; padding: 6px 10px; border: 2px dashed #8b5cf6; min-width: 100px; min-height: 25px; text-align: center; background-color: rgba(139, 92, 246, 0.05); border-radius: 4px; margin: 10px;">생년월일</div>`,
            category: '교환권 필드',
            attributes: { class: 'fa fa-calendar' }
          },
          {
            id: 'amount',
            label: '금액',
            content: `<div data-gjs-type="text" data-field="amount" style="display: block; font-size: 20px; font-weight: bold; color: #059669; padding: 10px 16px; border: 3px dashed #059669; min-width: 80px; min-height: 40px; text-align: center; background-color: rgba(5, 150, 105, 0.05); border-radius: 6px; margin: 10px;">금액</div>`,
            category: '교환권 필드',
            attributes: { class: 'fa fa-won-sign' }
          },
          {
            id: 'serial_no',
            label: '일련번호',
            content: `<div data-gjs-type="text" data-field="serial_no" style="display: block; font-family: monospace; font-size: 12px; padding: 6px 10px; border: 2px dashed #6b7280; min-width: 120px; min-height: 24px; text-align: center; background-color: rgba(107, 114, 128, 0.05); border-radius: 4px; margin: 10px;">일련번호</div>`,
            category: '교환권 필드',
            attributes: { class: 'fa fa-barcode' }
          },
          {
            id: 'qr_code',
            label: 'QR 코드',
            content: `<div data-gjs-type="image" data-field="qr_code" style="display: block; width: 80px; height: 80px; border: 2px dashed #666; background-color: #f9f9f9; text-align: center; line-height: 80px; font-size: 10px; color: #666; margin: 10px;">QR</div>`,
            category: '교환권 필드',
            attributes: { class: 'fa fa-qrcode' }
          },
          {
            id: 'barcode',
            label: '바코드',
            content: `<div data-gjs-type="image" data-field="barcode" style="display: block; width: 120px; height: 30px; border: 2px dashed #7c3aed; background-color: rgba(124, 58, 237, 0.05); text-align: center; line-height: 30px; font-size: 10px; color: #7c3aed; border-radius: 4px; margin: 10px;">BARCODE</div>`,
            category: '교환권 필드',
            attributes: { class: 'fa fa-barcode' }
          },
          // 기본 레이아웃 블록
          {
            id: 'text',
            label: '텍스트',
            content: '<div data-gjs-type="text" style="display: block; padding: 6px 12px; border: 2px dashed #6b7280; min-width: 60px; min-height: 25px; text-align: center; background-color: rgba(107, 114, 128, 0.05); border-radius: 4px; margin: 10px;">텍스트</div>',
            category: '기본',
            attributes: { class: 'fa fa-text-width' }
          },
          {
            id: 'container',
            label: '컨테이너',
            content: '<div style="display: block; padding: 12px; border: 2px dashed #3b82f6; min-width: 100px; min-height: 40px; background-color: rgba(59, 130, 246, 0.1); border-radius: 6px; text-align: center; font-size: 12px; color: #3b82f6; margin: 10px;">컨테이너</div>',
            category: '레이아웃',
            attributes: { class: 'fa fa-square' }
          },
          {
            id: 'row',
            label: '가로 배치',
            content: '<div style="display: flex; gap: 10px; padding: 8px; border: 2px dashed #10b981; min-height: 40px; background-color: rgba(16, 185, 129, 0.1); border-radius: 6px; margin: 10px;"><div style="flex: 1; padding: 8px; border: 1px dashed #ccc; text-align: center; min-width: 50px;">영역1</div><div style="flex: 1; padding: 8px; border: 1px dashed #ccc; text-align: center; min-width: 50px;">영역2</div></div>',
            category: '레이아웃',
            attributes: { class: 'fa fa-columns' }
          },
          {
            id: 'image',
            label: '이미지',
            content: '<img src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'60\'%3E%3Crect width=\'100\' height=\'60\' fill=\'%23f0f0f0\' stroke=\'%23ccc\'/%3E%3Ctext x=\'50\' y=\'30\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23999\' font-size=\'10\'%3E이미지%3C/text%3E%3C/svg%3E" style="display: block; border: 2px dashed #ef4444; border-radius: 4px; margin: 10px;" />',
            category: '기본',
            attributes: { class: 'fa fa-picture-o' }
          }
        ]
      }
    });

    // 배경 이미지 설정
    if (imageUrl) {
      const wrapper = gjsEditor.getWrapper();
      wrapper?.setStyle({
        'background-image': `url(${imageUrl})`,
        'background-size': 'cover',
        'background-position': 'center',
        'background-repeat': 'no-repeat',
        'min-height': '100%'
      });
    }

    // 캔버스 기본 설정 - 빈 캔버스 문제 해결
    const wrapper = gjsEditor.getWrapper();
    wrapper?.setStyle({
      'min-height': '500px',
      'background-color': '#ffffff',
      'padding': '20px',
      'position': 'relative'
    });
    
    // 빈 캔버스일 때 기본 컨텐츠 추가
    if (!initialData && gjsEditor.getComponents().length === 0) {
      gjsEditor.setComponents(`
        <div style="
          padding: 20px; 
          border: 2px dashed #ccc; 
          text-align: center; 
          margin: 20px; 
          border-radius: 8px; 
          background-color: #f9f9f9;
          color: #666;
          font-size: 14px;
        ">
          👈 왼쪽에서 블록을 드래그해서 디자인을 시작하세요
        </div>
      `);
    }

    // 사용자 정의 컴포넌트 타입 추가
    gjsEditor.DomComponents.addType('text', {
      isComponent: el => el.tagName === 'DIV' && el.hasAttribute('data-field'),
      model: {
        defaults: {
          tagName: 'div',
          draggable: true,
          droppable: false,
          editable: true,
          resizable: {
            tl: 1, // Top left
            tc: 1, // Top center
            tr: 1, // Top right
            cl: 1, // Center left
            cr: 1, // Center right
            bl: 1, // Bottom left
            bc: 1, // Bottom center
            br: 1  // Bottom right
          },
          // 기본 스타일 강제 적용
          style: {
            'visibility': 'visible',
            'display': 'block',
            'opacity': '1',
            'position': 'relative',
            'z-index': '1'
          },
          traits: [
            'id',
            {
              type: 'text',
              label: '텍스트',
              name: 'content'
            },
            {
              type: 'select',
              label: '텍스트 정렬',
              name: 'text-align',
              options: [
                { id: 'left', value: 'left', name: '왼쪽' },
                { id: 'center', value: 'center', name: '가운데' },
                { id: 'right', value: 'right', name: '오른쪽' }
              ]
            }
          ]
        }
      },
      view: {
        onRender() {
          // 렌더링 후 스타일 강제 적용
          const el = this.el;
          if (el) {
            el.style.visibility = 'visible';
            el.style.display = 'block';
            el.style.opacity = '1';
          }
        }
      }
    });

    // 초기 데이터 로드
    if (initialData) {
      gjsEditor.loadProjectData(initialData);
    }

    // 기본 커맨드 등록 (GrapesJS가 기대하는 필수 커맨드들)
    gjsEditor.Commands.add('sw-visibility', {
      run(editor: Editor) {
        const selected = editor.getSelected();
        if (selected) {
          const styles = selected.getStyle() as Record<string, any>;
          const isVisible = styles['visibility'] !== 'hidden';
          selected.setStyle({ ...styles, visibility: isVisible ? 'hidden' : 'visible' });
        }
      }
    });

    // 컴포넌트가 추가될 때마다 스타일 강제 적용
    gjsEditor.on('component:add', (component: any) => {
      const el = component.getEl();
      if (el) {
        // DOM 요소가 생성된 후에 스타일 적용
        setTimeout(() => {
          el.style.visibility = 'visible';
          el.style.display = 'block';
          el.style.opacity = '1';
        }, 100);
      }
    });

    // 캔버스 로드 완료 후 모든 요소 재점검
    gjsEditor.on('load', () => {
      setTimeout(() => {
        const canvas = gjsEditor.Canvas.getDocument();
        if (canvas) {
          const elements = canvas.querySelectorAll('[data-gjs-type], [data-field]');
          elements.forEach((el) => {
            const h = el as HTMLElement;
            h.style.visibility = 'visible';
            h.style.display = 'block';
            h.style.opacity = '1';
          });
        }
      }, 200);
    });

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

    // 필드 위치 추출
    const fieldPositions: Record<string, any> = {};
    
    editor.getComponents().forEach((component: any) => {
      const field = component.getAttributes()['data-field'];
      if (field) {
        const el = component.getEl();
        if (el) {
          const rect = el.getBoundingClientRect();
          const canvasRect = editorRef.current?.getBoundingClientRect();
          
          if (canvasRect) {
            fieldPositions[field] = {
              x: rect.left - canvasRect.left,
              y: rect.top - canvasRect.top,
              width: rect.width,
              height: rect.height,
              style: component.getStyle()
            };
          }
        }
      }
    });

    if (onSave) {
      onSave({
        html,
        css,
        json,
        components,
        fieldPositions
      });
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '700px' }}>
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
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
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
          <p style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '500',
            color: '#374151'
          }}>
            🎨 디자인 에디터 로딩 중...
          </p>
        </div>
      )}

      <div style={{
        display: 'flex',
        minHeight: '700px',
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
      }}>
        {/* 블록 패널 */}
        <div style={{
          width: '260px',
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e5e7eb',
          padding: '16px',
          overflowY: 'auto'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: '700',
              margin: 0,
              color: '#1f2937'
            }}>
              📦 디자인 요소
            </h4>
            <span style={{
              fontSize: '12px',
              color: '#6b7280',
              backgroundColor: '#f3f4f6',
              padding: '2px 6px',
              borderRadius: '10px'
            }}>
              드래그
            </span>
          </div>
          <div className="blocks-container"></div>
          
          {/* 도움말 */}
          <div style={{
            marginTop: '20px',
            padding: '12px',
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#0369a1'
          }}>
            💡 <strong>사용법:</strong><br/>
            • 블록을 캔버스로 드래그<br/>
            • 클릭하여 속성 편집<br/>
            • 모서리를 드래그하여 크기 조정
          </div>
        </div>

        {/* 캔버스 영역 */}
        <div style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* 툴바 */}
          <div style={{
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e5e7eb',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: '56px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            {/* 왼쪽: 디바이스 버튼 */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151',
                marginRight: '8px'
              }}>
                📱 화면 크기:
              </span>
              <button
                onClick={() => editor?.DeviceManager.select('A4 세로')}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                📄 A4 세로
              </button>
              <button
                onClick={() => editor?.DeviceManager.select('A4 가로')}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                📄 A4 가로
              </button>
              <button
                onClick={() => editor?.DeviceManager.select('Mobile')}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                📱 모바일
              </button>
              <button
                onClick={() => {
                  const json = editor?.getProjectData();
                  console.log('Template JSON:', json);
                  alert('콘솔에서 JSON 데이터를 확인하세요');
                }}
                style={{
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                JSON
              </button>
            </div>
            
            {/* 오른쪽: 액션 버튼 */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={handleSave}
                style={{
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#047857';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#059669';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                💾 저장하기
              </button>
            </div>
          </div>

          {/* GrapesJS 에디터 */}
          <div ref={editorRef} style={{ flex: 1, minHeight: '620px' }}></div>
        </div>

        {/* 속성 패널 */}
        <div style={{
          width: '280px',
          backgroundColor: '#ffffff',
          borderLeft: '1px solid #e5e7eb',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* 패널 헤더 */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f8fafc'
          }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: '700',
              margin: 0,
              color: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              🎨 속성 편집
            </h4>
            <p style={{
              fontSize: '12px',
              color: '#6b7280',
              margin: '4px 0 0 0'
            }}>
              선택된 요소의 속성을 편집하세요
            </p>
          </div>
          
          {/* 탭형 콘텐츠 */}
          <div style={{ flex: 1, padding: '16px' }}>
            {/* 속성 섹션 */}
            <div style={{ marginBottom: '24px' }}>
              <h5 style={{
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                ⚙️ 기본 속성
              </h5>
              <div className="traits-container"></div>
            </div>
            
            {/* 스타일 섹션 */}
            <div style={{ marginBottom: '24px' }}>
              <h5 style={{
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                🎨 스타일
              </h5>
              <div className="styles-container"></div>
            </div>
            
            {/* 레이어 섹션 */}
            <div>
              <h5 style={{
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                📚 레이어
              </h5>
              <div className="layers-container"></div>
            </div>
          </div>
          
          {/* 패널 하단 도움말 */}
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#fef3c7',
            borderTop: '1px solid #fbbf24',
            fontSize: '11px',
            color: '#92400e'
          }}>
            💡 <strong>팁:</strong> 요소를 선택하면 여기서 세부 속성을 편집할 수 있습니다.
          </div>
        </div>
      </div>
    </div>
  );
}