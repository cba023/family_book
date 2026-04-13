"use server";

import fs from "fs";
import path from "path";
import { Client } from "pg";
import { hashPassword } from "@/lib/auth/password";
import {
  loadRuntimeConfig,
  saveRuntimeConfig,
  generateAuthSecret,
  mergeEnvLocal,
  getEffectiveDatabaseUrl,
  getEffectiveAuthSecret,
} from "@/lib/runtime-config";
import { testDatabaseRaw, countProfiles } from "@/lib/setup-state";
import { resetPgPool } from "@/lib/pg";
import {
  validateUsernameForRegister,
  validateOptionalFullName,
  validateOptionalPhone,
} from "@/lib/auth/account-username";
import { setSessionCookieForUser } from "@/lib/auth/cookie-session";

export async function setupTestConnection(
  databaseUrl: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const url = databaseUrl.trim();
  if (!url) {
    return { ok: false, message: "请填写连接串" };
  }
  return testDatabaseRaw(url);
}

export async function setupSaveDatabaseUrl(
  databaseUrl: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const url = databaseUrl.trim();
  const t = await testDatabaseRaw(url);
  if (!t.ok) {
    return { ok: false, message: t.message };
  }
  const cur = loadRuntimeConfig();
  const authSecret = cur.authSecret?.length && cur.authSecret.length >= 16
    ? cur.authSecret
    : generateAuthSecret();
  saveRuntimeConfig({
    databaseUrl: url,
    authSecret,
    setupComplete: false,
  });
  resetPgPool();
  return { ok: true };
}

function splitSqlStatements(sql: string): string[] {
  const lines = sql.split(/\r?\n/);
  const cleaned = lines
    .map((l) => (l.match(/^\s*--/) ? "" : l))
    .join("\n");
  return cleaned
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function setupApplySchema(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const url = getEffectiveDatabaseUrl();
  if (!url) {
    return { ok: false, message: "请先保存数据库连接" };
  }
  const initPath = path.join(process.cwd(), "docker", "postgres", "init.sql");
  if (!fs.existsSync(initPath)) {
    return { ok: false, message: "缺少 docker/postgres/init.sql" };
  }
  const sql = fs.readFileSync(initPath, "utf-8");
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    for (const stmt of splitSqlStatements(sql)) {
      try {
        await client.query(stmt);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("already exists")) continue;
        throw e;
      }
    }
    await client.end();
  } catch (e) {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
  resetPgPool();
  return { ok: true };
}

export async function setupCreateSuperAdmin(input: {
  username: string;
  password: string;
  fullName?: string;
  phone?: string;
}): Promise<
  | { ok: true; needRestartForMiddleware: boolean }
  | { ok: false; message: string }
> {
  const url = getEffectiveDatabaseUrl();
  const secret = getEffectiveAuthSecret();
  if (!url || !secret) {
    return { ok: false, message: "配置不完整，请从第一步重新操作" };
  }
  const n = await countProfiles(url);
  if (n > 0) {
    return { ok: false, message: "已有用户，无法重复创建初始管理员" };
  }
  const uCheck = validateUsernameForRegister(input.username);
  if (!uCheck.ok) {
    return { ok: false, message: uCheck.error };
  }
  const fnCheck = validateOptionalFullName(input.fullName);
  if (!fnCheck.ok) {
    return { ok: false, message: fnCheck.error };
  }
  const phCheck = validateOptionalPhone(input.phone);
  if (!phCheck.ok) {
    return { ok: false, message: phCheck.error };
  }
  if (!input.password || input.password.length < 6) {
    return { ok: false, message: "密码至少 6 位" };
  }

  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query("BEGIN");
    const hash = await hashPassword(input.password);
    const { rows: uRows } = await client.query<{ id: string }>(
      `INSERT INTO app_users (password_hash) VALUES ($1) RETURNING id`,
      [hash],
    );
    const id = uRows[0]?.id;
    if (!id) throw new Error("创建用户失败");
    await client.query(
      `INSERT INTO profiles (id, role, username, full_name, phone)
       VALUES ($1, 'super_admin', $2, $3, $4)`,
      [id, uCheck.username, fnCheck.value, phCheck.value],
    );
    await client.query("COMMIT");
    await client.end();

    saveRuntimeConfig({ setupComplete: true });
    mergeEnvLocal(url, secret);
    resetPgPool();
    await setSessionCookieForUser(id);

    const needRestart =
      !process.env.DATABASE_URL?.trim() ||
      !process.env.AUTH_SECRET ||
      process.env.AUTH_SECRET.length < 16;

    return { ok: true, needRestartForMiddleware: needRestart };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
      await client.end();
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}
