import "server-only";

import { cookies } from "next/headers";
import { signSessionToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SEC } from "@/lib/auth/constants";

/**
 * 生产环境默认使用 Secure Cookie（仅 HTTPS 会下发/携带）。
 * 用 HTTP 访问容器（如 http://IP:3000）时必须设 AUTH_INSECURE_COOKIE=1，否则浏览器不会保存登录态。
 * 已用 HTTPS 反向代理且浏览器走 https 时，可省略或设为 0。
 */
export function sessionCookieUseSecure(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.AUTH_INSECURE_COOKIE !== "1"
  );
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
