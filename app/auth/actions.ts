"use server";

import { cookies } from "next/headers";
import { queryOne, withTransaction } from "@/lib/pg";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { setSessionCookieForUser } from "@/lib/auth/cookie-session";
import {
  validateUsernameForRegister,
  validateOptionalFullName,
  validateOptionalPhone,
} from "@/lib/auth/account-username";
import { getSessionUserId, getUserRole } from "@/lib/auth/session";

type UserAuthRow = { id: string; password_hash: string };

export async function signIn(
  username: string,
  password: string,
): Promise<{ error?: string }> {
  const uCheck = validateUsernameForRegister(username);
  if (!uCheck.ok) {
    return { error: uCheck.error };
  }
  if (!password) {
    return { error: "请输入密码" };
  }

  const row = await queryOne<UserAuthRow>(
    `SELECT u.id, u.password_hash
     FROM app_users u
     JOIN profiles p ON p.id = u.id
     WHERE lower(p.username) = lower($1)`,
    [uCheck.username],
  );
  if (!row) {
    return { error: "账户名或密码错误" };
  }
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) {
    return { error: "账户名或密码错误" };
  }
  await setSessionCookieForUser(row.id);
  return {};
}

export async function signUp(
  username: string,
  password: string,
  fullName: string,
  phone: string,
): Promise<{ error?: string }> {
  const uCheck = validateUsernameForRegister(username);
  if (!uCheck.ok) {
    return { error: uCheck.error };
  }
  const fnCheck = validateOptionalFullName(fullName);
  if (!fnCheck.ok) {
    return { error: fnCheck.error };
  }
  const phCheck = validateOptionalPhone(phone);
  if (!phCheck.ok) {
    return { error: phCheck.error };
  }
  if (!password || password.length < 6) {
    return { error: "密码至少 6 位" };
  }

  try {
    const newId = await withTransaction(async (client) => {
      const { rows: cntRows } = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM profiles`,
      );
      const isFirst = parseInt(cntRows[0]?.n ?? "0", 10) === 0;
      const role = isFirst ? "super_admin" : "user";
      const hash = await hashPassword(password);
      const { rows: uRows } = await client.query<{ id: string }>(
        `INSERT INTO app_users (password_hash) VALUES ($1) RETURNING id`,
        [hash],
      );
      const id = uRows[0]?.id;
      if (!id) throw new Error("创建用户失败");
      await client.query(
        `INSERT INTO profiles (id, role, username, full_name, phone)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          id,
          role,
          uCheck.username,
          fnCheck.value,
          phCheck.value,
        ],
      );
      return id;
    });
    await setSessionCookieForUser(newId);
    return {};
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      typeof msg === "string" &&
      msg.includes("profiles_username_lower_key")
    ) {
      return { error: "该账户名已被注册" };
    }
    console.error("signUp", e);
    return { error: "注册失败，请稍后重试" };
  }
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function updateOwnPassword(
  newPassword: string,
): Promise<{ error?: string }> {
  if (!newPassword || newPassword.length < 6) {
    return { error: "密码至少 6 位" };
  }
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "请先登录" };
  }
  const hash = await hashPassword(newPassword);
  const { getPool } = await import("@/lib/pg");
  await getPool().query(`UPDATE app_users SET password_hash = $1 WHERE id = $2`, [
    hash,
    userId,
  ]);
  return {};
}

export async function checkClientAuth(): Promise<{ loggedIn: boolean; canPost: boolean }> {
  const { user, role } = await getUserRole();
  const canPost = Boolean(user && (role === "super_admin" || role === "admin"));
  return { loggedIn: Boolean(user), canPost };
}
