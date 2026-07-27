/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    serverActions: { allowedOrigins: ["*"] },
    // 패키지 최적화 - 번들 크기 감소
    optimizePackageImports: [
      '@supabase/supabase-js',
      'date-fns',
      'lodash',
      'zod',
      'react-icons',
      'lucide-react'
    ],
  },
  trailingSlash: false,
  typescript: {
    // 타입 에러를 빌드에서 차단 (typecheck 통과 상태 유지). 끄지 말 것.
    ignoreBuildErrors: false,
  },
  // Next 16부터 next.config의 eslint 키 미지원(빌드 시 lint 실행 안 함). lint는 `npm run lint`로 별도 실행.
  // 이미지 최적화
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24, // 24시간 캐시
  },
  // 컴파일러 최적화
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  // Turbopack 설정 (Next.js 16 기본)
  // 상위 폴더의 고아 lockfile로 인한 워크스페이스 루트 오추론 방지 - 루트를 이 프로젝트로 고정
  turbopack: {
    root: __dirname,
  },
  // Webpack 최적화 (프로덕션 빌드용 - Turbopack과 함께 사용 가능)
  webpack: (config, { dev, isServer }) => {
    // 개발 모드에서는 Turbopack 사용, 프로덕션 빌드에서만 webpack 사용
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: -10,
          },
          supabase: {
            test: /[\\/]node_modules[\\/]@supabase[\\/]/,
            name: 'supabase',
            chunks: 'all',
            priority: 10,
          }
        }
      }
    }
    return config
  },
  // Docker 배포를 위한 standalone 출력
  output: process.env.DOCKER_BUILD ? 'standalone' : undefined,
  // 헤더 캐시 설정
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' }
        ]
      },
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ]
      }
    ]
  }
}
module.exports = nextConfig
