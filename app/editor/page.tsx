'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Mail } from 'lucide-react';

// VoucherEmailEditor 사용
const VoucherEmailEditor = dynamic(
  () => import('@/components/admin/vouchers/VoucherEmailEditor').then(mod => mod.VoucherEmailEditor),
  {
    ssr: false,
    loading: () => (
      <div style={{ padding: '40px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <Mail size={18} /> 이메일 에디터 로딩 중...
      </div>
    )
  }
);

export default function EditorPage() {
  const [templateData, setTemplateData] = useState<any>(null);
  const [mode, setMode] = useState<'a4' | 'mobile'>('a4');
  const [templateId, setTemplateId] = useState<string | null>(null);

  // URL 파라미터에서 데이터 가져오기
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode') as 'a4' | 'mobile';
    const dataParam = params.get('data');
    const sessionKeyParam = params.get('sessionKey');
    const templateIdParam = params.get('templateId');
    
    console.log('📋 에디터 페이지 파라미터 분석:', { 
      modeParam, 
      hasData: !!dataParam, 
      hasSessionKey: !!sessionKeyParam,
      templateIdParam,
      dataLength: dataParam?.length || 0,
      fullUrlLength: window.location.href.length
    });
    
    if (modeParam) {
      setMode(modeParam);
    }
    
    if (templateIdParam) {
      setTemplateId(templateIdParam);
    }
    
    // 데이터 소스 결정 (URL parameter vs sessionStorage)
    let dataSource = '';
    let dataSourceType = '';
    
    if (sessionKeyParam) {
      // sessionStorage에서 데이터 로드
      console.log('📦 sessionStorage에서 데이터 로드 시도:', sessionKeyParam);
      try {
        const sessionData = sessionStorage.getItem(sessionKeyParam);
        if (sessionData) {
          dataSource = sessionData;
          dataSourceType = 'sessionStorage';
          console.log('✅ sessionStorage 데이터 로드 성공');
          
          // 사용 후 sessionStorage 정리
          sessionStorage.removeItem(sessionKeyParam);
          console.log('🧹 sessionStorage 정리 완료');
        } else {
          console.error('❌ sessionStorage에서 데이터를 찾을 수 없음:', sessionKeyParam);
          alert('템플릿 데이터를 찾을 수 없습니다. 새 디자인으로 시작합니다.');
        }
      } catch (error) {
        console.error('❌ sessionStorage 접근 실패:', error);
        alert('템플릿 데이터 로드에 실패했습니다.');
      }
    } else if (dataParam) {
      // URL 파라미터에서 데이터 로드
      dataSource = dataParam;
      dataSourceType = 'urlParameter';
    }
    
    if (dataSource) {
      console.log('🔍 데이터 파싱 시작:', {
        dataSourceType,
        rawDataLength: dataSource.length,
        isValidEncoding: dataSourceType === 'urlParameter' && dataSource.includes('%'),
        firstChars: dataSource.substring(0, 50) + '...'
      });
      
      try {
        let decodedData = '';
        
        if (dataSourceType === 'sessionStorage') {
          // sessionStorage 데이터는 이미 디코딩된 JSON 문자열
          console.log('📦 sessionStorage 데이터 사용 (디코딩 불필요)');
          decodedData = dataSource;
        } else {
          // URL 파라미터 데이터는 인코딩되어 있으므로 디코딩 필요
          console.log('1️⃣ URL 디코딩 시작');
          decodedData = decodeURIComponent(dataSource);
          console.log('✅ URL 디코딩 성공');
        }
        
        console.log('✅ 디코딩 완료:', {
          decodedLength: decodedData.length,
          isValidJSON: decodedData.startsWith('{') || decodedData.startsWith('['),
          firstChars: decodedData.substring(0, 100) + '...'
        });
        
        // JSON 파싱
        console.log('2️⃣ JSON 파싱 시작');
        const parsedData = JSON.parse(decodedData);
        console.log('✅ JSON 파싱 성공:', {
          dataType: typeof parsedData,
          hasBody: !!parsedData?.body,
          hasRows: !!parsedData?.body?.rows,
          rowsCount: parsedData?.body?.rows?.length || 0,
          hasComplexStructure: JSON.stringify(parsedData).includes('columns')
        });
        
        setTemplateData(parsedData);
        console.log('✅ 템플릿 데이터 설정 완료');
        
      } catch (error) {
        console.error('❌ 데이터 파싱 실패:', error);
        
        // 상세한 에러 분석
        if (error instanceof URIError) {
          console.error('🔗 URL 디코딩 에러:', {
            message: error.message,
            dataSourceType,
            dataPreview: dataSource.substring(0, 200) + '...',
            suggestedCause: 'URL 인코딩이 손상되었거나 특수 문자 문제'
          });
          alert('URL 데이터 디코딩에 실패했습니다. 템플릿이 너무 복잡하거나 데이터가 손상되었을 수 있습니다.');
        } else if (error instanceof SyntaxError) {
          console.error('📄 JSON 파싱 에러:', {
            message: error.message,
            dataSourceType,
            dataPreview: dataSource.substring(0, 200) + '...',
            suggestedCause: 'JSON 구조가 올바르지 않거나 데이터가 절단됨'
          });
          alert('템플릿 데이터 형식이 올바르지 않습니다. 새 디자인으로 시작합니다.');
        } else {
          console.error('🔧 알 수 없는 에러:', {
            message: (error as Error).message,
            errorType: (error as Error).constructor.name,
            dataSourceType,
            stack: (error as Error).stack
          });
          alert('템플릿 데이터를 불러오는 중 알 수 없는 오류가 발생했습니다.');
        }
        
        // 에러 발생 시 templateData를 null로 설정하여 새 디자인으로 시작
        setTemplateData(null);
      }
    } else {
      console.log('📝 템플릿 데이터 없음 - 새 디자인 시작');
    }
  }, []);

  // 저장 핸들러 - 부모 창으로 데이터 전송
  const handleSave = (data: any) => {
    console.log('에디터 저장 요청:', { templateId, mode, data });
    
    if (window.opener) {
      window.opener.postMessage({
        type: 'EDITOR_SAVE',
        mode: mode,
        templateId: templateId,
        data: data
      }, window.location.origin);
      
      console.log('부모 창으로 저장 메시지 전송 완료');
      
      // 저장 후 창 닫기
      setTimeout(() => {
        window.close();
      }, 500);
    } else {
      console.log('부모 창이 없음 - 저장 데이터:', data);
      alert('저장이 완료되었습니다.');
    }
  };

  return (
    <div style={{ 
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh'
    }}>
      <VoucherEmailEditor
        templateId={templateId || undefined}
        onSave={handleSave}
        initialData={templateData || undefined}
        mode={mode}
      />
    </div>
  );
}