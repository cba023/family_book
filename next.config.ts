import type { NextConfig } from "next";

/**
 * 公网经反向代理访问时，若浏览器 Origin 与 Host / X-Forwarded-Host 不完全一致，
 * Next.js 会拦截 Server Action（含登录），表现为登录无报错但会话不生效。
 * 构建镜像前设置，例如：SERVER_ACTIONS_ALLOWED_ORIGINS=example.com,www.example.com
 * 支持通配域名片段（见 Next.js `experimental.serverActions.allowedOrigins` 文档）。
 */
function serverActionsAllowedOriginsFromEnv(): string[] | undefined {
  const raw = process.env.SERVER_ACTIONS_ALLOWED_ORIGINS?.trim();
  if (!raw) return undefined;
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : undefined;
}

const serverActionsAllowedOrigins = serverActionsAllowedOriginsFromEnv();

const nextConfig: NextConfig = {
  // 会话依赖 cookies()；开启 cacheComponents 可能导致预渲染阶段 cookies() 失败
  cacheComponents: false,
  output: 'standalone', // 优化 Docker 构建
  poweredByHeader: false, // 隐藏 X-Powered-By 头
  ...(serverActionsAllowedOrigins
    ? {
        experimental: {
          serverActions: {
            allowedOrigins: serverActionsAllowedOrigins,
          },
        },
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
};

export default nextConfig;
