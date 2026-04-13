/** 界面仅展示账户名；部分展示场景用固定后缀合成占位「邮箱」便于沿用既有 UI 逻辑。 */
export const SYNTHETIC_EMAIL_DOMAIN = "account.familybook.local";

const RESERVED = new Set([
  "admin",
  "root",
  "system",
  "super_admin",
  "anon",
  "service_role",
  "null",
  "undefined",
  "api",
  "www",
]);

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

/** 规则：仅小写字母、数字、下划线；首字符不能为数字（须为 a-z 或 _） */
export function isValidUsernamePattern(normalized: string): boolean {
  return /^[a-z_][a-z0-9_]*$/.test(normalized);
}

export function validateUsernameForRegister(
  input: string,
): { ok: true; username: string } | { ok: false; error: string } {
  const u = normalizeUsername(input);
  if (u.length < 2 || u.length > 32) {
    return { ok: false, error: "账户名长度为 2～32 个字符" };
  }
  if (!isValidUsernamePattern(u)) {
    return {
      ok: false,
      error: "须以字母或下划线开头，只能包含小写字母、数字、下划线",
    };
  }
  if (RESERVED.has(u)) {
    return { ok: false, error: "该账户名为系统保留，请换一个" };
  }
  return { ok: true, username: u };
}

export function syntheticEmailFromUsername(username: string): string {
  return `${normalizeUsername(username)}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

/**
 * profiles 行缺失或 username 未回填时，从会话用户解析展示用账户名
 *（user_metadata.username 或 合成邮箱的本地段）
 */
export function usernameFromAuthSessionUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string | null {
  const raw = user.user_metadata?.username;
  if (typeof raw === "string") {
    const u = normalizeUsername(raw);
    if (u.length > 0) return u;
  }
  const email = user.email;
  const suffix = `@${SYNTHETIC_EMAIL_DOMAIN}`;
  if (email && email.toLowerCase().endsWith(suffix.toLowerCase())) {
    const at = email.indexOf("@");
    if (at > 0) {
      const local = normalizeUsername(email.slice(0, at));
      if (local.length > 0) return local;
    }
  }
  return null;
}

export function validateOptionalFullName(
  input: string | undefined,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (input == null || input.trim() === "") {
    return { ok: true, value: null };
  }
  const t = input.trim();
  if (t.length > 50) {
    return { ok: false, error: "姓名最多 50 个字" };
  }
  return { ok: true, value: t };
}

/** 选填：中国大陆手机或留空 */
export function validateOptionalPhone(
  input: string | undefined,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (input == null || input.trim() === "") {
    return { ok: true, value: null };
  }
  const digits = input.replace(/\s/g, "");
  if (!/^1[3-9]\d{9}$/.test(digits)) {
    return { ok: false, error: "手机号须为 11 位中国大陆号码，或留空" };
  }
  return { ok: true, value: digits };
}
