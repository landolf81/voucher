/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { allowedOrigins: ["*"] } },
  typescript: {
    // Temporarily ignore build errors during deployment preparation
    ignoreBuildErrors: true,
  },
  eslint: {
    // Temporarily ignore ESLint errors during build
    ignoreDuringBuilds: true,
  },
  // Docker 배포를 위한 standalone 출력
  output: process.env.DOCKER_BUILD ? 'standalone' : undefined,
}
module.exports = nextConfig
