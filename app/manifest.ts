import type { MetadataRoute } from 'next';

// Next.js App Router 네이티브 매니페스트. /manifest.webmanifest 로 제공되고
// <link rel="manifest"> 가 자동 주입된다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '교환권 관리 시스템',
    short_name: '교환권',
    description: '교환권 발행·검증·사용 관리 (Voucher)',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4f46e5',
    lang: 'ko',
    dir: 'ltr',
    orientation: 'portrait-primary',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
