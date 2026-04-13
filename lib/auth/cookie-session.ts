import "server-only";

import { cookies } from "next/headers";
import { signSessionToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SEC } from "@/lib/auth/constants";

/**
 * 默认不使用 Secure Cookie，**HTTP（内网、花生壳 HTTP、IP:端口）与 HTTPS 均可登录**。
 * 全站仅 HTTPS、希望 Cookie 带 Secure 时设 AUTH_USE_SECURE_COOKIE=1。
 * 兼容旧变量：AUTH_INSECURE_COOKIE=0 等价于强制 Secure；=1 强制非 Secure。
 */
export function sessionCookieUseSecure(): boolean {
  if (process.env.AUTH_USE_SECURE_COOKIE === "1") {
    return true;
  }
  if (process.env.AUTH_INSECURE_COOKIE === "0") {
    return true;
  }
  if (process.env.AUTH_INSECURE_COOKIE === "1") {
    return false;
  }
  return false;
}

export async function setSessionCookieForUser(userId: string): Promise<void> {
  const token = await signSessionToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: sessionCookieUseSecure(),
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SEC,
    path: "/",
  });
}
