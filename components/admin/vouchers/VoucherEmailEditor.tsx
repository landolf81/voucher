'use client';

import React, { useRef, useState, useEffect } from 'react';
import EmailEditor, { EditorRef } from 'react-email-editor';

// react-email-editor의 forwardRef 타입이 React 19 타입과 충돌하여 any로 별칭 처리
const AnyEmailEditor: any = EmailEditor;

interface VoucherEmailEditorProps {
  templateId?: string;
  onSave?: (data: any) => void;
  initialData?: any;
  imageUrl?: string;
  mode?: 'a4' | 'mobile';
}


export function VoucherEmailEditor({ 
  templateId, 
  onSave, 
  initialData,
  imageUrl,
  mode = 'a4'
}: VoucherEmailEditorProps) {
  const emailEditorRef = useRef<EditorRef>(null);
  const [isLoading, setIsLoading] = useState(true);


  const onReady = () => {
    const unlayer = emailEditorRef.current?.editor;
    
    if (unlayer) {
      console.log('📧 이메일 에디터 준비 완료');
      
      // 좌측 도구 패널 강제 표시
      try {
        (unlayer as any).showPanel('tools');
        console.log('좌측 도구 패널 표시 완료');
      } catch (error) {
        console.log('패널 표시 중 오류:', error);
      }
      
      // 초기 디자인 로드
      if (!initialData) {
        console.log('🆕 새 디자인으로 시작');
        try {
          unlayer.loadDesign({
            body: {
              rows: [{
                cells: [1],
                columns: [{
                  contents: [{
                    type: 'text',
                    values: {
                      text: '<div style="text-align: center; padding: 30px; border: 2px dashed #d1d5db; margin: 20px; border-radius: 12px; background-color: #f9fafb;"><h3 style="color: #374151; margin-bottom: 16px;">🎨 교환권 디자인을 시작하세요</h3><p style="color: #6b7280; margin: 0;">좌측 패널에서 교환권 전용 블록들을 드래그하여 디자인을 만들어보세요.</p></div>'
                    }
                  }]
                }]
              }]
            }
          } as any);
        } catch (error) {
          console.error('❌ 기본 템플릿 로드 실패:', error);
          alert('에디터 초기화에 실패했습니다. 페이지를 새로고침해주세요.');
        }
      } else {
        console.log('🔄 기존 디자인 로드 시작:', {
          dataType: typeof initialData,
          hasBody: !!initialData?.body,
          hasRows: !!initialData?.body?.rows,
          rowsCount: initialData?.body?.rows?.length || 0,
          dataSize: JSON.stringify(initialData).length
        });
        
        try {
          // 데이터 유효성 검증
          if (!initialData.body || !initialData.body.rows) {
            throw new Error('잘못된 디자인 데이터 구조: body.rows가 없습니다');
          }
          
          // 복잡한 구조 감지
          const hasComplexStructure = JSON.stringify(initialData).includes('columns') && JSON.stringify(initialData).includes('cells');
          if (hasComplexStructure) {
            console.info('🔍 복잡한 컬럼 구조 감지됨');
          }
          
          unlayer.loadDesign(initialData);
          console.log('✅ 기존 디자인 로드 성공');
          
        } catch (error) {
          console.error('❌ 기존 디자인 로드 실패:', error);
          console.log('📄 실패한 데이터:', JSON.stringify(initialData, null, 2));
          
          // 사용자에게 오류 상황 알림
          const errorMessage = `디자인 로드에 실패했습니다.\n\n오류: ${error instanceof Error ? error.message : String(error)}\n\n새 디자인으로 시작하시겠습니까?`;
          
          if (confirm(errorMessage)) {
            // 기본 템플릿으로 대체
            try {
              unlayer.loadDesign({
                body: {
                  rows: [{
                    cells: [1],
                    columns: [{
                      contents: [{
                        type: 'text',
                        values: {
                          text: '<div style="text-align: center; padding: 30px; border: 2px solid #ef4444; margin: 20px; border-radius: 12px; background-color: #fef2f2;"><h3 style="color: #dc2626; margin-bottom: 16px;">⚠️ 디자인 로드 실패</h3><p style="color: #991b1b; margin: 0;">기존 디자인을 불러올 수 없어 새 디자인으로 시작합니다.</p></div>'
                        }
                      }]
                    }]
                  }]
                }
              } as any);
              console.log('✅ 대체 템플릿 로드 성공');
            } catch (fallbackError) {
              console.error('❌ 대체 템플릿도 로드 실패:', fallbackError);
              alert('에디터를 초기화할 수 없습니다. 페이지를 새로고침해주세요.');
            }
          } else {
            window.close(); // 사용자가 취소하면 창 닫기
          }
        }
      }
      
      setIsLoading(false);
    }
  };

  const handleSaveTemplate = () => {
    const unlayer = emailEditorRef.current?.editor;
    
    if (unlayer) {
      unlayer.exportHtml((data: any) => {
        const { design, html } = data;
        
        console.log('💾 템플릿 저장:', { design, html });
        
        if (onSave) {
          onSave({
            design,
            html,
            css: '' // Unlayer includes CSS in HTML
          });
        }
      });
    }
  };

  const handlePreview = () => {
    const unlayer = emailEditorRef.current?.editor;
    
    if (unlayer) {
      unlayer.exportHtml((data: any) => {
        const { html } = data;
        
        // 새 창에서 미리보기
        const previewWindow = window.open('', '_blank');
        if (previewWindow) {
          previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>교환권 미리보기</title>
              <meta charset="UTF-8">
              <style>
                body { font-family: 'Noto Sans KR', Arial, sans-serif; margin: 20px; }
                .voucher-field { margin: 8px 0; }
              </style>
            </head>
            <body>
              ${html}
            </body>
            </html>
          `);
          previewWindow.document.close();
        }
      });
    }
  };

  // Canvas dimensions based on mode
  const getCanvasDimensions = () => {
    if (mode === 'mobile') {
      return { width: 400, height: 600 }; // Mobile portrait
    }
    return { width: 595, height: 842 }; // A4 in pixels (72 DPI)
  };

  const dimensions = getCanvasDimensions();

  return (
    <div style={{ 
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      backgroundColor: '#f3f4f6',
      margin: 0,
      padding: 0
    }}>
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
          zIndex: 1000
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
            📧 이메일 에디터 로딩 중...
          </p>
        </div>
      )}

      <div style={{
        backgroundColor: '#1f2937',
        borderBottom: '1px solid #374151',
        flexShrink: 0
      }}>
        <div style={{
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
        }}>
          <h2 style={{ color: 'white', margin: 0, fontSize: '18px' }}>
            {mode === 'a4' ? '📄 A4 교환권 디자인 에디터' : '📱 모바일 교환권 디자인 에디터'}
          </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handlePreview}
            style={{
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            👁️ 미리보기
          </button>
          <button
            onClick={handleSaveTemplate}
            style={{
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            💾 저장
          </button>
        </div>
        </div>
        
        {/* 변수 사용법 안내 */}
        <div style={{
          backgroundColor: '#065f46',
          color: 'white',
          padding: '8px 20px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>💡</span>
          <span>
            텍스트 블록을 추가한 후, 우측 패널에서 "Merge Tags" 탭을 클릭하여 교환권 변수를 삽입하세요.
            (예: <code style={{backgroundColor: 'rgba(255,255,255,0.2)', padding: '2px 4px', borderRadius: '3px'}}>&#123;&#123;name&#125;&#125;</code>, 
            <code style={{backgroundColor: 'rgba(255,255,255,0.2)', padding: '2px 4px', borderRadius: '3px'}}>&#123;&#123;qr_code:200&#125;&#125;</code>)
          </span>
        </div>
        
        {/* 레이어 기능 안내 */}
        <div style={{
          backgroundColor: '#7c2d12',
          color: 'white',
          padding: '8px 20px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>🎨</span>
          <span>
            레이어 겹치기: 요소를 선택하고 우측 패널의 "Advanced" → "Custom CSS"에서 클래스를 추가하세요.
            (overlay-text, floating-element, layered-element, background-layer)
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <AnyEmailEditor
          ref={emailEditorRef}
          onReady={onReady}
          style={{ height: '100%', display: 'block' }}
          options={{
            displayMode: 'email',
            locale: 'ko-KR',
            appearance: {
              theme: 'light',
              minWidth: '100%'
            },
            features: {
              stockImages: true,
              preview: true,
              textEditor: {
                spellChecker: false
              }
            },
            safeHtml: true,
            customJS: [
              `data:text/javascript;charset=utf-8;base64,${Buffer.from(`
                  // Force show left panel on load and extend fonts
                  setTimeout(() => {
                    if (typeof unlayer !== 'undefined') {
                      console.log('Unlayer available, checking panels...');
                      // Show tools panel on left
                      unlayer.showPanel('tools');
                      
                      // Add more Korean fonts
                      try {
                        unlayer.setFonts([
                          // Google Fonts Korean
                          { name: 'Noto Sans KR', url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@100;300;400;500;700;900&display=swap' },
                          { name: 'Nanum Gothic', url: 'https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&display=swap' },
                          { name: 'Nanum Myeongjo', url: 'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap' },
                          { name: 'IBM Plex Sans KR', url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@100;200;300;400;500;600;700&display=swap' },
                          { name: 'Black Han Sans', url: 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap' },
                          { name: 'Jua', url: 'https://fonts.googleapis.com/css2?family=Jua&display=swap' },
                          { name: 'Do Hyeon', url: 'https://fonts.googleapis.com/css2?family=Do+Hyeon&display=swap' },
                          { name: 'Gamja Flower', url: 'https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap' },
                          { name: 'Gothic A1', url: 'https://fonts.googleapis.com/css2?family=Gothic+A1:wght@100;200;300;400;500;600;700;800;900&display=swap' },
                          { name: 'Gugi', url: 'https://fonts.googleapis.com/css2?family=Gugi&display=swap' },
                          { name: 'Hi Melody', url: 'https://fonts.googleapis.com/css2?family=Hi+Melody&display=swap' },
                          { name: 'Kirang Haerang', url: 'https://fonts.googleapis.com/css2?family=Kirang+Haerang&display=swap' },
                          { name: 'Nanum Brush Script', url: 'https://fonts.googleapis.com/css2?family=Nanum+Brush+Script&display=swap' },
                          { name: 'Nanum Pen Script', url: 'https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap' },
                          { name: 'Stylish', url: 'https://fonts.googleapis.com/css2?family=Stylish&display=swap' },
                          { name: 'Single Day', url: 'https://fonts.googleapis.com/css2?family=Single+Day&display=swap' },
                          { name: 'Song Myung', url: 'https://fonts.googleapis.com/css2?family=Song+Myung&display=swap' },
                          { name: 'Sunflower', url: 'https://fonts.googleapis.com/css2?family=Sunflower:wght@300;500;700&display=swap' },
                          { name: 'Yeon Sung', url: 'https://fonts.googleapis.com/css2?family=Yeon+Sung&display=swap' },
                          // Basic Web Safe Fonts
                          { name: 'Arial', url: '' },
                          { name: 'Helvetica', url: '' },
                          { name: 'Times New Roman', url: '' },
                          { name: 'Georgia', url: '' },
                          { name: 'Verdana', url: '' },
                          { name: 'Tahoma', url: '' },
                          { name: 'Trebuchet MS', url: '' },
                          { name: 'Impact', url: '' },
                          { name: 'Comic Sans MS', url: '' },
                          { name: 'Courier New', url: '' }
                        ]);
                        console.log('Extended fonts loaded successfully');
                      } catch (error) {
                        console.error('Error setting fonts:', error);
                      }
                      
                      // Add custom CSS for layering and positioning
                      try {
                        const customCSS = \`
                          .unlayer-block {
                            position: relative !important;
                          }
                          .layered-element {
                            position: absolute !important;
                            z-index: 10 !important;
                          }
                          .overlay-text {
                            position: absolute !important;
                            z-index: 20 !important;
                            background: rgba(255,255,255,0.9) !important;
                            padding: 10px !important;
                            border-radius: 8px !important;
                          }
                          .floating-element {
                            position: relative !important;
                            transform: translateY(-20px) !important;
                            z-index: 15 !important;
                          }
                          .background-layer {
                            position: absolute !important;
                            top: 0 !important;
                            left: 0 !important;
                            width: 100% !important;
                            height: 100% !important;
                            z-index: 1 !important;
                          }
                        \`;
                        
                        // Inject custom CSS
                        const style = document.createElement('style');
                        style.textContent = customCSS;
                        document.head.appendChild(style);
                        console.log('Custom layering CSS injected');
                      } catch (error) {
                        console.error('Error injecting custom CSS:', error);
                      }
                    }
                  }, 1000);
                `).toString('base64')}`
            ],
            mergeTags: [
              {
                name: '이름',
                value: '{{name}}',
                sample: '홍길동'
              },
              {
                name: '금액',
                value: '{{amount}}',
                sample: '50,000원'
              },
              {
                name: '일련번호',
                value: '{{serial_no}}',
                sample: 'V2025-0001'
              },
              {
                name: '영농회',
                value: '{{association}}',
                sample: '성주사과농협'
              },
              {
                name: '조합원ID',
                value: '{{member_id}}',
                sample: 'M123456'
              },
              {
                name: '생년월일',
                value: '{{dob}}',
                sample: '1980-01-01'
              },
              {
                name: '전화번호',
                value: '{{phone}}',
                sample: '010-1234-5678'
              },
              {
                name: '발행일',
                value: '{{issued_at}}',
                sample: '2025-01-18'
              },
              {
                name: 'QR코드 (기본)',
                value: '{{qr_code}}',
                sample: '[QR코드 180px]'
              },
              {
                name: 'QR코드 (소형)',
                value: '{{qr_code:120}}',
                sample: '[QR코드 120px]'
              },
              {
                name: 'QR코드 (중형)',
                value: '{{qr_code:200}}',
                sample: '[QR코드 200px]'
              },
              {
                name: 'QR코드 (대형)',
                value: '{{qr_code:250}}',
                sample: '[QR코드 250px]'
              },
              {
                name: '바코드 (기본)',
                value: '{{barcode}}',
                sample: '[바코드 60px]'
              },
              {
                name: '바코드 (소형)',
                value: '{{barcode:40}}',
                sample: '[바코드 40px]'
              },
              {
                name: '바코드 (중형)',
                value: '{{barcode:80}}',
                sample: '[바코드 80px]'
              },
              {
                name: '바코드 (대형)',
                value: '{{barcode:100}}',
                sample: '[바코드 100px]'
              }
            ]
          }}
        />
      </div>

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        /* react-email-editor container */
        .react-email-editor {
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
        }
        
        /* Override iframe min-height */
        iframe[src*="unlayer"] {
          min-height: unset !important;
          height: 100% !important;
          width: 100% !important;
        }
        
        /* Force container to full height */
        div[style*="min-height"] {
          min-height: unset !important;
        }
        
        /* Force Unlayer panels to be visible */
        .blockbuilder-tools-panel {
          display: block !important;
          visibility: visible !important;
        }
        
        .blockbuilder-properties-panel {
          display: block !important;
          visibility: visible !important;
        }
        
        .blockbuilder-left-panel {
          display: flex !important;
          visibility: visible !important;
        }
        
        .blockbuilder-right-panel {
          display: flex !important;
          visibility: visible !important;
        }
      `}</style>
    </div>
  );
}