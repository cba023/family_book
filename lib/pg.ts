import { Pool, type QueryResultRow } from "pg";
import { getEffectiveDatabaseUrl } from "@/lib/runtime-config";

let pool: Pool | null = null;
let poolUrl: string | null = null;

export function resetPgPool(): void {
  if (pool) {
    void pool.end();
  }
  pool = null;
  poolUrl = null;
}

export function getPool(): Pool {
  const connectionString = getEffectiveDatabaseUrl();
  if (!connectionString) {
    throw new Error("未配置数据库：请完成初始化向导或设置 DATABASE_URL");
  }
  if (!pool || poolUrl !== connectionString) {
    if (pool) void pool.end();
    poolUrl = connectionString;
    pool = new Pool({ connectionString: poolUrl, max: 15 });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const r = await getPool().query<T>(text, params);
  return r.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
