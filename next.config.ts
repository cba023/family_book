import type { NextConfig } from "next";

/**
 * Server Actions（登录、表单等）会做 Origin 与 Host 校验。
 * 内网穿透 / 花生壳 / cpolar / 反代下两者常不一致，导致「登录后状态不变」。
 *
 * 默认始终启用 allowedOrigins: ['**']，与穿透、多域名、局域网直连均可开箱即用（家庭族谱场景）。
 * 若你对外提供多用户 SaaS 且反代已严格对齐 Host，可在**构建时**设 SERVER_ACTIONS_STRICT_ORIGIN=1，
 * 并可选 SERVER_ACTIONS_ALLOWED_ORIGINS 白名单（逗号分隔，含端口时写 host:port）。
 */
function serverActionsExperimental():
  | { serverActions: { allowedOrigins: string[] } }
  | undefined {
  if (process.env.SERVER_ACTIONS_STRICT_ORIGIN === "1") {
    const raw = process.env.SERVER_ACTIONS_ALLOWED_ORIGINS?.trim();
    if (!raw) {
      return undefined;
    }
    if (raw === "**") {
      return { serverActions: { allowedOrigins: ["**"] } };
    }
    const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) {
      return undefined;
    }
    return { serverActions: { allowedOrigins: list } };
  }
  return { serverActions: { allowedOrigins: ["**"] } };
}

const serverActionsExp = serverActionsExperimental();

const nextConfig: NextConfig = {
  // 会话依赖 cookies()；开启 cacheComponents 可能导致预渲染阶段 cookies() 失败
  cacheComponents: false,
  output: 'standalone', // 优化 Docker 构建
  poweredByHeader: false, // 隐藏 X-Powered-By 头
  ...(serverActionsExp
    ? {
        experimental: serverActionsExp,
      }
    : {}),
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
  async rewrites() {
    const seaweedfsUrl = process.env.SEAWEEDFS_URL || 'http://192.168.1.8:18888';
    return [
      {
        source: '/uploads/:path*',
        destination: `${seaweedfsUrl}/images/:path*`,
      },
    ];
  },
};

export default nextConfig;
