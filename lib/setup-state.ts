import { Client } from "pg";
import {
  getEffectiveDatabaseUrl,
  loadRuntimeConfig,
  saveRuntimeConfig,
} from "@/lib/runtime-config";

export type SetupStep = "connection" | "schema" | "admin" | "complete";

/** 不经过连接池，仅用连接串探测 */
export async function testDatabaseRaw(
  connectionString: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const c = new Client({ connectionString, connectionTimeoutMillis: 8000 });
  try {
    await c.connect();
    await c.query("SELECT 1");
    await c.end();
    return { ok: true };
  } catch (e) {
    try {
      await c.end();
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}

export async function tableExists(
  connectionString: string,
  name: string,
): Promise<boolean> {
  const c = new Client({ connectionString });
  try {
    await c.connect();
    const r = await c.query<{ reg: string | null }>(
      `SELECT to_regclass($1)::text AS reg`,
      [`public.${name}`],
    );
    await c.end();
    return Boolean(r.rows[0]?.reg);
  } catch {
    try {
      await c.end();
    } catch {
      /* ignore */
    }
    return false;
  }
}

export async function countProfiles(connectionString: string): Promise<number> {
  const c = new Client({ connectionString });
  try {
    await c.connect();
    const r = await c.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM profiles`,
    );
    await c.end();
    return parseInt(r.rows[0]?.n ?? "0", 10);
  } catch {
    try {
      await c.end();
    } catch {
      /* ignore */
    }
    return -1;
  }
}

/**
 * 当前应处于的安装步骤（服务端 Node 调用）
 */
export async function getSetupStep(): Promise<SetupStep> {
  const file = loadRuntimeConfig();
  if (file.setupComplete) {
    return "complete";
  }

  const url = getEffectiveDatabaseUrl();
  if (!url) {
    return "connection";
  }

  const t = await testDatabaseRaw(url);
  if (!t.ok) {
    return "connection";
  }

  const hasProfiles = await tableExists(url, "profiles");
  if (!hasProfiles) {
    return "schema";
  }

  const n = await countProfiles(url);
  if (n < 0) {
    return "schema";
  }
  if (n === 0) {
    return "admin";
  }

  if (!file.setupComplete) {
    saveRuntimeConfig({ setupComplete: true });
  }
  return "complete";
}
