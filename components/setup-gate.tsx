import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSetupStep } from "@/lib/setup-state";

/**
 * 未完成初始化时，除白名单路径外一律进入 /setup。
 * 构建阶段设置 SKIP_SETUP_GATE=1 跳过（无数据库时避免阻塞 next build）。
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

  const allowed =
    path.startsWith("/setup") ||
    path.startsWith("/_next") ||
    path.startsWith("/api/") ||
    path === "/favicon.ico" ||
    path === "/icon.png" ||
    path.startsWith("/opengraph") ||
    path.startsWith("/twitter");

  if (allowed) {
    return children;
  }

  const step = await getSetupStep();
  if (step === "complete") {
    return children;
  }

  redirect("/setup");
}
