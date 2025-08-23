/**
 * 디바이스 감지 및 UI 분기를 위한 유틸리티
 */

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  hasTouch: boolean;
}

/**
 * User-Agent 문자열에서 디바이스 정보 추출
 */
export function parseUserAgent(userAgent: string): Partial<DeviceInfo> {
  const ua = userAgent.toLowerCase();
  
  return {
    userAgent,
    isIOS: /iphone|ipad|ipod/.test(ua),
    isAndroid: /android/.test(ua),
    isSafari: /safari/.test(ua) && !/chrome/.test(ua),
    isChrome: /chrome/.test(ua) && !/edg/.test(ua),
  };
}

/**
 * 화면 크기 기반 디바이스 타입 판별
 */
export function getDeviceTypeByScreen(width: number): Pick<DeviceInfo, 'isMobile' | 'isTablet' | 'isDesktop'> {
  if (width < 768) {
    return { isMobile: true, isTablet: false, isDesktop: false };
  } else if (width < 1024) {
    return { isMobile: false, isTablet: true, isDesktop: false };
  } else {
    return { isMobile: false, isTablet: false, isDesktop: true };
  }
}

/**
 * 전체 디바이스 정보 가져오기 (클라이언트 사이드 전용)
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    // 서버 사이드 렌더링 시 기본값
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isIOS: false,
      isAndroid: false,
      isSafari: false,
      isChrome: false,
      userAgent: '',
      screenWidth: 1920,
      screenHeight: 1080,
      hasTouch: false,
    };
  }

  const userAgent = navigator.userAgent;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  const uaInfo = parseUserAgent(userAgent);
  const screenInfo = getDeviceTypeByScreen(screenWidth);

  // 모바일 디바이스는 터치 지원과 User-Agent를 함께 확인
  const isMobileDevice = screenInfo.isMobile || (hasTouch && (uaInfo.isIOS || uaInfo.isAndroid));

  return {
    ...uaInfo,
    ...screenInfo,
    isMobile: isMobileDevice,
    isTablet: !isMobileDevice && screenInfo.isTablet,
    isDesktop: !isMobileDevice && !screenInfo.isTablet,
    screenWidth,
    screenHeight,
    hasTouch,
  } as DeviceInfo;
}

/**
 * 미디어 쿼리 매칭 확인
 */
export function matchesMediaQuery(query: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(query).matches;
}

/**
 * 디바이스별 클래스명 생성
 */
export function getDeviceClassName(deviceInfo: DeviceInfo): string {
  const classes: string[] = [];
  
  if (deviceInfo.isMobile) classes.push('device-mobile');
  if (deviceInfo.isTablet) classes.push('device-tablet');
  if (deviceInfo.isDesktop) classes.push('device-desktop');
  if (deviceInfo.hasTouch) classes.push('has-touch');
  if (deviceInfo.isIOS) classes.push('os-ios');
  if (deviceInfo.isAndroid) classes.push('os-android');
  
  return classes.join(' ');
}

/**
 * 디바이스 방향 감지
 */
export function getOrientation(): 'portrait' | 'landscape' {
  if (typeof window === 'undefined') return 'landscape';
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}

/**
 * 안전한 영역 인셋 가져오기 (iOS 노치 대응)
 */
export function getSafeAreaInsets() {
  if (typeof window === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const computedStyle = getComputedStyle(document.documentElement);
  
  return {
    top: parseInt(computedStyle.getPropertyValue('--sat') || '0'),
    right: parseInt(computedStyle.getPropertyValue('--sar') || '0'),
    bottom: parseInt(computedStyle.getPropertyValue('--sab') || '0'),
    left: parseInt(computedStyle.getPropertyValue('--sal') || '0'),
  };
}