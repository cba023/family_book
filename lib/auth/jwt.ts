import { SignJWT, jwtVerify } from "jose";

function getSecretKey(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 16) {
    throw new Error(
      "请配置 AUTH_SECRET（至少 16 字符），用于签发登录会话",
    );
  }
  return new TextEncoder().encode(raw);
}

export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const sub = payload.sub;
    if (typeof sub !== "string" || !sub) return null;
    return { sub };
  } catch {
    return null;
  }
}

/** 中间件用：无密钥或非法 token 时不抛错 */
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
