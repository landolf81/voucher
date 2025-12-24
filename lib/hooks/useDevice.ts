/**
 * 디바이스 감지를 위한 React 훅
 */

import { useState, useEffect } from 'react';
import { DeviceInfo, getDeviceInfo } from '@/lib/device';

/**
 * 디바이스 정보를 관리하는 훅
 */
export function useDevice(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => getDeviceInfo());

  useEffect(() => {
    // 클라이언트 사이드에서 디바이스 정보 업데이트
    setDeviceInfo(getDeviceInfo());

    // 화면 크기 변경 감지
    const handleResize = () => {
      setDeviceInfo(getDeviceInfo());
    };

    // 방향 변경 감지
    const handleOrientationChange = () => {
      // 방향 변경 후 약간의 지연을 두고 크기 재계산
      setTimeout(() => {
        setDeviceInfo(getDeviceInfo());
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return deviceInfo;
}

/**
 * 모바일 여부만 확인하는 간단한 훅
 */
export function useIsMobile(): boolean {
  const device = useDevice();
  return device.isMobile;
}

/**
 * 터치 지원 여부 확인하는 훅
 */
export function useHasTouch(): boolean {
  const device = useDevice();
  return device.hasTouch;
}

/**
 * 화면 크기 변경을 감지하는 훅
 */
export function useScreenSize(): { width: number; height: number } {
  const device = useDevice();
  return {
    width: device.screenWidth,
    height: device.screenHeight,
  };
}

/**
 * 디바이스별 스타일을 반환하는 훅
 */
export function useDeviceStyles() {
  const device = useDevice();

  const styles = {
    container: {
      padding: device.isMobile ? '16px' : '24px',
      maxWidth: device.isMobile ? '100%' : '1200px',
      margin: '0 auto',
    },
    
    button: {
      padding: device.isMobile ? '12px 16px' : '14px 20px',
      fontSize: device.isMobile ? '16px' : '14px',
      minHeight: device.hasTouch ? '44px' : '36px', // 터치 최소 크기
    },
    
    input: {
      padding: device.isMobile ? '14px' : '12px',
      fontSize: device.isMobile ? '16px' : '14px', // iOS 줌 방지
      minHeight: device.hasTouch ? '44px' : '36px',
    },
    
    modal: {
      width: device.isMobile ? '95%' : '500px',
      maxHeight: device.isMobile ? '90vh' : '80vh',
      margin: device.isMobile ? '5vh auto' : '10vh auto',
    },
    
    navigation: {
      height: device.isMobile ? '60px' : '50px',
      position: device.isMobile ? 'fixed' as const : 'static' as const,
      bottom: device.isMobile ? '0' : 'auto',
    },
  };

  return styles;
}

/**
 * 미디어 쿼리를 React 훅으로 사용
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * 다크모드 감지 훅
 */
export function usePrefersDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

/**
 * 감소된 모션 선호도 감지 훅
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * 디바이스별 네비게이션 스타일 결정
 */
export function useNavigationStyle(): 'mobile' | 'desktop' {
  const device = useDevice();
  return device.isMobile ? 'mobile' : 'desktop';
}