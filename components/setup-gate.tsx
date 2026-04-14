import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSetupStep } from "@/lib/setup-state";
import { autoInitialize } from "@/lib/auto-init";
import { loadRuntimeConfig } from "@/lib/runtime-config";

/**
 * 启动时自动初始化数据库，未完成前仅允许访问 /setup。
 * 如需手动干预，可访问 /setup 使用原向导。
 */
export async function SetupGate({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.SKIP_SETUP_GATE === "1") {
    return children;
  }

  const h = await headers();
  const path = h.get("x-pathname") ?? "";

  // 白名单路径
  const allowed =
    path.startsWith("/setup") ||
    path.startsWith("/_next") ||
    path.startsWith("/api/") ||
    path === "/favicon.ico" ||
    path === "/icon.png" ||
    path.startsWith("/opengraph") ||
    path.startsWith("/twitter");

  // 如果是 /setup 或 API 请求，直接放行（让页面或接口处理）
  if (allowed) {
    return children;
  }

  // 检查是否已初始化
  const step = await getSetupStep();
  if (step === "complete") {
    return children;
  }

  // 尝试自动初始化
  const config = loadRuntimeConfig();
  const hasDatabaseUrl = !!config.databaseUrl || !!process.env.DATABASE_URL?.trim();
  const hasAuthSecret = !!config.authSecret || !!process.env.AUTH_SECRET?.trim();

  if (hasDatabaseUrl && hasAuthSecret) {
    const result = await autoInitialize();
    if (result.success) {
      return children;
    }
    // 自动初始化失败，转到手动向导让用户排查问题
    console.error("自动初始化失败:", result.message);
  }

  redirect("/setup");
}
