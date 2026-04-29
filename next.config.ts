import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "dist",
  images: {
    unoptimized: true,
  },
  // 静态导出配置
  trailingSlash: true,
};

export default nextConfig;
