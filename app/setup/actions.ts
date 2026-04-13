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

/** 库名：字母/数字/下划线，1～63 字符，且需为合法 PG 标识符 */
const DB_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;

export type DatabaseConnectionParts = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  createDatabaseIfNotExists: boolean;
};

function buildPostgresUrl(parts: {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}): string {
  const { host, port, user, password, database } = parts;
  const auth =
    password.length > 0
      ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
      : `${encodeURIComponent(user)}`;
  return `postgresql://${auth}@${host}:${port}/${encodeURIComponent(database)}`;
}

function validateDbParts(
  p: DatabaseConnectionParts,
): { ok: true } | { ok: false; message: string } {
  const host = p.host.trim();
  if (!host) {
    return { ok: false, message: "请填写主机地址" };
  }
  const port = parseInt(p.port.trim(), 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    return { ok: false, message: "端口应为 1～65535 的整数" };
  }
  const user = p.user.trim();
  if (!user) {
    return { ok: false, message: "请填写数据库用户名" };
  }
  const db = p.database.trim();
  if (!db) {
    return { ok: false, message: "请填写数据库名" };
  }
  if (!DB_NAME_RE.test(db)) {
    return {
      ok: false,
      message:
        "数据库名仅允许字母、数字、下划线，不能以数字开头，长度 1～63",
    };
  }
  return { ok: true };
}

/**
 * 仅测试能否连上实例上的 maintenance 库 postgres（第二步「测试账号」）
 */
export async function setupTestPostgresLogin(
  host: string,
  port: string,
  user: string,
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const h = host.trim();
  const po = parseInt(port.trim(), 10);
  if (!h) {
    return { ok: false, message: "请填写主机地址" };
  }
  if (Number.isNaN(po) || po < 1 || po > 65535) {
    return { ok: false, message: "端口应为 1～65535 的整数" };
  }
  const u = user.trim();
  if (!u) {
    return { ok: false, message: "请填写数据库用户名" };
  }
  const url = buildPostgresUrl({
    host: h,
    port: po,
    user: u,
    password,
    database: "postgres",
  });
  return testDatabaseRaw(url);
}

async function ensureDatabaseAndVerifyUrl(
  parts: DatabaseConnectionParts,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const v = validateDbParts(parts);
  if (!v.ok) {
    return v;
  }
  const host = parts.host.trim();
  const port = parseInt(parts.port.trim(), 10);
  const user = parts.user.trim();
  const { password } = parts;
  const database = parts.database.trim();

  const maintenanceUrl = buildPostgresUrl({
    host,
    port,
    user,
    password,
    database: "postgres",
  });

  const maintenance = new Client({
    connectionString: maintenanceUrl,
    connectionTimeoutMillis: 12000,
  });

  try {
    await maintenance.connect();

    const exists = await maintenance.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM pg_database WHERE datname = $1
       ) AS exists`,
      [database],
    );
    const hasDb = Boolean(exists.rows[0]?.exists);

    if (!hasDb) {
      if (!parts.createDatabaseIfNotExists) {
        await maintenance.end();
        return {
          ok: false,
          message:
            "该数据库尚不存在。请勾选「若不存在则创建数据库」，或先在 PostgreSQL 中手动创建。",
        };
      }
      const safeIdent = `"${database.replace(/"/g, '""')}"`;
      try {
        await maintenance.query(`CREATE DATABASE ${safeIdent}`);
      } catch (ce) {
        await maintenance.end();
        const cm = ce instanceof Error ? ce.message : String(ce);
        if (cm.includes("already exists")) {
          /* race */
        } else {
          return {
            ok: false,
            message:
              cm.includes("permission denied") || cm.includes("must be owner")
                ? `创建数据库失败（权限不足）：${cm}。请使用有 CREATEDB 权限或超级用户账号，或先在服务器上手动建库。`
                : `创建数据库失败：${cm}`,
          };
        }
      }
    }

    await maintenance.end();
  } catch (e) {
    try {
      await maintenance.end();
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: msg.includes("password")
        ? `连接失败：${msg}（请检查主机、端口、用户名与密码）`
        : `连接失败：${msg}`,
    };
  }

  const url = buildPostgresUrl({
    host,
    port,
    user,
    password,
    database,
  });
  const test = await testDatabaseRaw(url);
  if (!test.ok) {
    return { ok: false, message: test.message };
  }
  return { ok: true, url };
}

/** 第三步：测试目标库是否可用（必要时创建库） */
export async function setupTestDatabaseParts(
  parts: DatabaseConnectionParts,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const r = await ensureDatabaseAndVerifyUrl(parts);
  if (!r.ok) {
    return r;
  }
  return { ok: true };
}

/** 第三步：保存连接（与测试使用同一套校验） */
export async function setupSaveDatabaseFromParts(
  parts: DatabaseConnectionParts,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const r = await ensureDatabaseAndVerifyUrl(parts);
  if (!r.ok) {
    return r;
  }
  const url = r.url;
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
