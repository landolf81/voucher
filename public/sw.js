/* 교환권 PWA 서비스워커 — 설치 가능성 충족 + 보수적 캐싱.
 * 정책:
 *  - 인증/동적 데이터를 깨지 않도록 /api 와 교차출처(Supabase 등)는 절대 캐시하지 않음.
 *  - 페이지 내비게이션: network-first → 오프라인 시 캐시 폴백 → 오프라인 안내.
 *  - 정적 자산(/_next/static, /icons): cache-first (해시 파일명이라 안전).
 */
const VERSION = 'v1';
const STATIC_CACHE = `static-${VERSION}`;
const PAGES_CACHE = `pages-${VERSION}`;
const OFFLINE_URL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGES_CACHE).then((cache) => cache.add(OFFLINE_URL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, PAGES_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 교차출처(Supabase, 폰트 등) · API 는 손대지 않음 (인증/실시간 보호)
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // 정적 자산: cache-first
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            return res;
          })
      )
    );
    return;
  }

  // 페이지 내비게이션: network-first → 캐시 폴백
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          const copy = res.clone();
          caches.open(PAGES_CACHE).then((c) => c.put(request, copy));
          return res;
        } catch {
          const cached = await caches.match(request);
          return cached || (await caches.match(OFFLINE_URL)) || Response.error();
        }
      })()
    );
  }
});
