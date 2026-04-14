import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

/**
 * 本地模式：邮箱验证路由
 * 直接跳转到家族故事页，不需要验证
 */
export async function GET(request: NextRequest) {
  // 本地模式：跳过验证，直接跳转
  redirect("/blog");
}
