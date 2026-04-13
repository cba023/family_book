#!/usr/bin/env tsx
/**
 * 使用 pg_dump 备份 PostgreSQL（需本机或 PATH 中有 pg_dump，或 DATABASE_URL 可连）
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";

const BACKUP_DIR = path.join(process.cwd(), "backups");
const MAX_BACKUPS = 30;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log("📁 创建备份目录:", BACKUP_DIR);
  }
}

function cleanOldBackups() {
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("genealogy-pg-") && f.endsWith(".dump"))
    .map((f) => ({
      name: f,
      path: path.join(BACKUP_DIR, f),
      time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length > MAX_BACKUPS) {
    const toDelete = files.slice(MAX_BACKUPS);
    console.log(`🧹 清理 ${toDelete.length} 个旧备份...`);
    for (const file of toDelete) {
      fs.unlinkSync(file.path);
      console.log("   删除:", file.name);
    }
  }
}

function runPgDump(outPath: string): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return Promise.reject(new Error("缺少 DATABASE_URL"));
  }
  return new Promise((resolve, reject) => {
    const child = spawn("pg_dump", ["-Fc", "-f", outPath, url], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump 退出码 ${code}`));
    });
  });
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("      PostgreSQL 备份（pg_dump -Fc）");
  console.log("═══════════════════════════════════════\n");

  ensureBackupDir();

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `genealogy-pg-${ts}.dump`;
  const outPath = path.join(BACKUP_DIR, filename);

  try {
    await runPgDump(outPath);
    const stats = fs.statSync(outPath);
    console.log("✅ 备份成功:", filename);
    console.log(`📊 大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    cleanOldBackups();
  } catch (e) {
    console.error("❌ 备份失败:", e);
    console.error(
      "\n提示: 请安装 PostgreSQL 客户端工具，或将 DATABASE_URL 指向可访问的数据库。",
    );
    process.exit(1);
  }
}

main();
