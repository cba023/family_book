import { Client } from "pg";
import { hashPassword } from "@/lib/auth/password";
import {
  loadRuntimeConfig,
  saveRuntimeConfig,
} from "@/lib/runtime-config";
import { resetPgPool } from "@/lib/pg";
import { validateUsernameForRegister } from "@/lib/auth/account-username";

const INIT_SQL_PATH = "/app/docker/postgres/init.sql";

export async function autoInitialize(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // 从环境变量或配置文件获取数据库连接
    const dbUrl =
      process.env.DATABASE_URL?.trim() ||
      loadRuntimeConfig().databaseUrl?.trim();

    if (!dbUrl) {
      return {
        success: false,
        message: "缺少数据库连接配置，请在 .env.local 中设置 DATABASE_URL",
      };
    }

    const secret =
      process.env.AUTH_SECRET?.trim() ||
      loadRuntimeConfig().authSecret?.trim();

    if (!secret || secret.length < 16) {
      return {
        success: false,
        message: "缺少 AUTH_SECRET，请在 .env.local 中设置（至少 16 位随机字符串）",
      };
    }

    // 1. 测试数据库连接
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
      return {
        success: false,
        message: `数据库连接失败: ${msg}`,
      };
    }

    // 2. 执行建表脚本
    const fs = await import("fs");
    const path = await import("path");
    const sqlPath = path.resolve(process.cwd(), "docker/postgres/init.sql");

    if (!fs.existsSync(sqlPath)) {
      await client.end();
      return {
        success: false,
        message: `缺少建表脚本: ${sqlPath}`,
      };
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
          return {
            success: false,
            message: `建表失败: ${msg}`,
          };
        }
      }
    }

    // 3. 检查是否已有用户，若没有则创建默认管理员
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

      // 验证用户名格式
      const usernameCheck = validateUsernameForRegister(adminUsername);
      if (!usernameCheck.ok) {
        await client.end();
        return {
          success: false,
          message: `默认管理员用户名无效: ${usernameCheck.error}`,
        };
      }

      if (adminPassword.length < 6) {
        await client.end();
        return {
          success: false,
          message: "默认管理员密码至少需要 6 位",
        };
      }

      // 创建用户
      const passwordHash = await hashPassword(adminPassword);
      const userResult = await client.query<{ id: string }>(
        "INSERT INTO app_users (password_hash) VALUES ($1) RETURNING id",
        [passwordHash],
      );

      if (!userResult.rows[0]?.id) {
        await client.end();
        return { success: false, message: "创建管理员用户失败" };
      }

      const userId = userResult.rows[0].id;

      // 创建 profile
      await client.query(
        `INSERT INTO profiles (id, role, username, full_name, phone)
         VALUES ($1, 'super_admin', $2, $3, $4)`,
        [userId, adminUsername, adminFullName, adminPhone],
      );

      message = `初始化完成，默认管理员已创建: ${adminUsername}`;
    }

    await client.end();

    // 4. 标记初始化完成
    saveRuntimeConfig({ setupComplete: true });
    resetPgPool();

    return {
      success: true,
      message,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, message: `初始化失败: ${msg}` };
  }
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
