import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 全站多处使用 Supabase SSR（cookies）；开启 cacheComponents 会导致预渲染阶段 cookies() 失败
  cacheComponents: false,
  output: 'standalone', // 优化 Docker 构建
  poweredByHeader: false, // 隐藏 X-Powered-By 头
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ],
      },
    ];
  },
};

export default nextConfig;
