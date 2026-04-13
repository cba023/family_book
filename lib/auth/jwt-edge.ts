import { jwtVerify } from "jose";

/** Edge 中间件专用：仅读 process.env，不可引用 runtime-config（无 fs） */
export async function verifySessionTokenOptional(
  token: string | undefined,
): Promise<{ sub: string } | null> {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 16 || !token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(raw));
    const sub = payload.sub;
    if (typeof sub !== "string" || !sub) return null;
    return { sub };
  } catch {
    return null;
  }
}
