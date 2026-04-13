#!/usr/bin/env tsx
/**
 * 使用 pg_restore 从 pg_dump -Fc 备份恢复（会清空并覆盖目标库中的同名对象）
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { spawn } from "child_process";

const BACKUP_DIR = path.join(process.cwd(), "backups");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function listBackups(): string[] {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log("❌ 备份目录不存在");
    return [];
  }

  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("genealogy-pg-") && f.endsWith(".dump"))
    .map((f) => ({
      name: f,
      time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time)
    .map((f) => f.name);
}

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function runPgRestore(backupPath: string): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return Promise.reject(new Error("缺少 DATABASE_URL"));
  }
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pg_restore",
      ["--clean", "--if-exists", "-d", url, backupPath],
      { stdio: "inherit", env: process.env },
    );
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || code === 1) resolve();
      else reject(new Error(`pg_restore 退出码 ${code}`));
    });
  });
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("      PostgreSQL 恢复（pg_restore）");
  console.log("═══════════════════════════════════════\n");

  const backups = listBackups();

  if (backups.length === 0) {
    console.log("❌ 没有找到 .dump 备份（前缀 genealogy-pg-）");
    rl.close();
    return;
  }

  console.log("📦 可用备份:\n");
  backups.forEach((f, i) => {
    const stats = fs.statSync(path.join(BACKUP_DIR, f));
    const size = (stats.size / 1024).toFixed(1);
    const date = stats.mtime.toLocaleString("zh-CN");
    console.log(`  ${i + 1}. ${f}`);
    console.log(`     大小: ${size} KB | 时间: ${date}\n`);
  });

  const input = await prompt("请选择备份 (序号或文件名，回车取消): ");

  if (!input.trim()) {
    console.log("\n❌ 已取消");
    rl.close();
    return;
  }

  let selectedBackup: string;
  const index = parseInt(input, 10) - 1;

  if (!isNaN(index) && index >= 0 && index < backups.length) {
    selectedBackup = backups[index];
  } else if (backups.includes(input)) {
    selectedBackup = input;
  } else {
    console.log("\n❌ 无效输入");
    rl.close();
    return;
  }

  const backupPath = path.join(BACKUP_DIR, selectedBackup);

  console.log(`\n⚠️  将使用 pg_restore --clean 覆盖 DATABASE_URL 指向的数据库。`);
  const confirm = await prompt(`确认恢复 "${selectedBackup}" ? 输入 yes : `);

  if (confirm.toLowerCase() !== "yes") {
    console.log("\n❌ 已取消");
    rl.close();
    return;
  }

  try {
    await runPgRestore(backupPath);
    console.log("\n✅ 恢复完成");
  } catch (error) {
    console.error("\n❌ 恢复失败:", error);
    console.error(
      "\n提示: 退出码 1 时 pg_restore 可能仍有部分可恢复；请检查日志。需已安装 pg_restore。",
    );
  }

  rl.close();
}

main();
