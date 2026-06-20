// Global type declarations for the voucher system

// CSS 사이드이펙트 import 타입 선언 (Next 버전차로 `import './globals.css'`가
// "Cannot find module declarations for side-effect import" 타입에러 나는 것 방지)
declare module '*.css';

declare module '@zxing/browser' {
  export class BrowserMultiFormatReader {
    static listVideoInputDevices(): Promise<any[]>;
    decodeFromVideoDevice(): Promise<any>;
    decodeFromVideoDevice(deviceId: string | undefined, videoElement: HTMLVideoElement, callback: (result: any, error: any) => void): Promise<any>;
    reset(): void;
    stopContinuousDecode(): void;
  }
  
  export class BrowserQRCodeReader {
    static listVideoInputDevices(): Promise<any[]>;
    decodeFromVideoDevice(): Promise<any>;
    decodeFromVideoDevice(deviceId: string | undefined, videoElement: HTMLVideoElement, callback: (result: any, error: any) => void): Promise<any>;
    reset(): void;
    stopContinuousDecode(): void;
  }
}

declare module 'react-email-editor' {
  export interface Design {
    type: string;
    values: any;
  }

  export interface MergeTags {
    [key: string]: any;
  }

  export interface EditorProps {
    onReady?: () => void;
    onLoad?: (data: { id: string; contents: Design[]; values: Record<string, any> }) => void;
    onDesignLoad?: (data: { id: string; contents: Design[]; values: Record<string, any> }) => void;
    options?: {
      actionBar?: {
        placement?: 'top' | 'bottom' | 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';
      };
      features?: object;
      loader?: {
        url?: string;
        html?: string;
        css?: string;
      };
      panels?: any;
      theme?: string;
      minWidth?: number;
      mergeTags?: MergeTags;
      customJS?: string[];
    };
  }

  export interface Editor {
    exportHtml: (callback: (data: { design: any; html: string }) => void) => void;
    loadDesign: (design: { id: string; contents: Design[]; values: Record<string, any> }) => void;
    showPanel?: (panel: string) => void;
  }

  export default function EmailEditor(props: EditorProps & { ref?: React.RefObject<Editor> }): JSX.Element;
}

// Extend NextRequest interface
declare module 'next/server' {
  interface NextRequest {
    ip?: string;
  }
}

// Add window interface extensions
declare global {
  interface Window {
    grapesjs?: any;
  }
}

export {};