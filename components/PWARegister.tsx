'use client';

import { useEffect } from 'react';

// 서비스워커 등록. dev(Turbopack HMR)에서의 캐시 꼬임을 피하려고 production 에서만 등록한다.
// 로컬 설치 테스트는 `npm run build && npm start` 로 하면 된다.
export default function PWARegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.error('SW 등록 실패:', err));
    };

    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
