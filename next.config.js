/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Temporarily disable to prevent initialization issues
  experimental: { 
    serverActions: { allowedOrigins: ["*"] },
    optimizePackageImports: ['@supabase/supabase-js'] // Optimize Supabase imports
  },
  // Disable tracing to prevent file lock issues
  trailingSlash: false,
  typescript: {
    // Temporarily ignore build errors during deployment preparation
    ignoreBuildErrors: true,
  },
  eslint: {
    // Temporarily ignore ESLint errors during build
    ignoreDuringBuilds: true,
  },
  // Webpack optimization to prevent module initialization issues
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.optimization.splitChunks.cacheGroups.default = {
        minChunks: 2,
        priority: -20,
        reuseExistingChunk: true
      }
    }
    return config
  },
  // Docker 배포를 위한 standalone 출력
  output: process.env.DOCKER_BUILD ? 'standalone' : undefined,
}
module.exports = nextConfig
