/**
 * 读取 .env.local，执行 docker/postgres/init.sql 并创建默认管理员（若库中无用户）。
 * 不依赖 lib/runtime-config（避免 server-only 在非 Next 环境下无法加载）。
 * 用法：npm run init
 */
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { resolve } from "path";
import { Client } from "pg";
import { hashPassword } from "../lib/auth/password";
import { validateUsernameForRegister } from "../lib/auth/account-username";

config({ path: resolve(process.cwd(), ".env.local") });

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

function saveSetupCompleteFlag() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const rcPath = path.join(dataDir, "runtime-config.json");
  let cur: Record<string, unknown> = {};
  if (fs.existsSync(rcPath)) {
    try {
      cur = JSON.parse(fs.readFileSync(rcPath, "utf-8")) as Record<
        string,
        unknown
      >;
    } catch {
      /* ignore */
    }
  }
  fs.writeFileSync(
    rcPath,
    JSON.stringify({ ...cur, setupComplete: true }, null, 2) + "\n",
    "utf-8",
  );
}

async function main() {
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.error("缺少 DATABASE_URL，请在 .env.local 中配置。");
    process.exit(1);
  }

  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 16) {
    console.error("缺少 AUTH_SECRET（至少 16 位），请在 .env.local 中配置。");
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    await client.query("SELECT 1");
  } catch (e) {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("数据库连接失败:", msg);
    process.exit(1);
  }

  const sqlPath = path.resolve(process.cwd(), "docker/postgres/init.sql");
  if (!fs.existsSync(sqlPath)) {
    await client.end();
    console.error("缺少建表脚本:", sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf-8");
  const statements = splitSqlStatements(sql);

  for (const stmt of statements) {
    try {
      await client.query(stmt);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("already exists")) {
        try {
          await client.end();
        } catch {
          /* ignore */
        }
        console.error("建表失败:", msg);
        process.exit(1);
      }
    }
  }

  const countResult = await client.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM profiles",
  );
  const userCount = parseInt(countResult.rows[0]?.count || "0", 10);

  let message = "数据库已就绪";
  if (userCount === 0) {
    const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || "chief_admin";
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin123456";
    const adminFullName = process.env.DEFAULT_ADMIN_FULL_NAME || "系统管理员";
    const adminPhone = process.env.DEFAULT_ADMIN_PHONE || "";

    const usernameCheck = validateUsernameForRegister(adminUsername);
    if (!usernameCheck.ok) {
      await client.end();
      console.error("默认管理员用户名无效:", usernameCheck.error);
      process.exit(1);
    }

    if (adminPassword.length < 6) {
      await client.end();
      console.error("默认管理员密码至少需要 6 位");
      process.exit(1);
    }

    const passwordHash = await hashPassword(adminPassword);
    const userResult = await client.query<{ id: string }>(
      "INSERT INTO app_users (password_hash) VALUES ($1) RETURNING id",
      [passwordHash],
    );

    if (!userResult.rows[0]?.id) {
      await client.end();
      console.error("创建管理员用户失败");
      process.exit(1);
    }

    const userId = userResult.rows[0].id;

    await client.query(
      `INSERT INTO profiles (id, role, username, full_name, phone)
       VALUES ($1, 'super_admin', $2, $3, $4)`,
      [userId, adminUsername, adminFullName, adminPhone],
    );

    message = `初始化完成，默认管理员已创建: ${adminUsername}`;
  }

  await client.end();
  saveSetupCompleteFlag();
  console.log(message);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
