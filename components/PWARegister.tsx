'use client';

import { useEffect } from 'react';

// 서비스워커 등록. dev(Turbopack HMR)에서의 캐시 꼬임을 피하려고 production 에서만 등록한다.
// 로컬 설치 테스트는 `npm run build && npm start` 로 하면 된다.
export default function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      // 로컬 프로덕션 테스트(npm start)로 등록된 SW가 남아 있으면 dev 청크(URL이 내용과 무관하게
      // 고정)를 cache-first로 서빙해 옛 코드가 계속 실행된다 → dev에서는 등록 해제 + 캐시 삭제.
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
      return;
    }

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
