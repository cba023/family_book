#!/usr/bin/env tsx
/**
 * 数据库恢复脚本
 * 
 * 使用方法:
 * npx tsx scripts/restore.ts <备份文件名>
 * 例如: npx tsx scripts/restore.ts genealogy-backup-2024-01-15T10-30-00.db
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'genealogy.db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function listBackups(): string[] {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('❌ 备份目录不存在');
    return [];
  }

  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('genealogy-backup-') && f.endsWith('.db'))
    .map(f => ({
      name: f,
      time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time)
    .map(f => f.name);
}

function prompt(question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('      族谱数据库恢复工具');
  console.log('═══════════════════════════════════════\n');

  const backups = listBackups();

  if (backups.length === 0) {
    console.log('❌ 没有找到备份文件');
    rl.close();
    return;
  }

  console.log('📦 可用的备份文件:\n');
  backups.forEach((f, i) => {
    const stats = fs.statSync(path.join(BACKUP_DIR, f));
    const size = (stats.size / 1024).toFixed(1);
    const date = stats.mtime.toLocaleString('zh-CN');
    console.log(`  ${i + 1}. ${f}`);
    console.log(`     大小: ${size} KB | 时间: ${date}\n`);
  });

  const input = await prompt('请选择要恢复的备份 (输入序号或文件名，直接回车取消): ');
  
  if (!input.trim()) {
    console.log('\n❌ 已取消恢复');
    rl.close();
    return;
  }

  let selectedBackup: string;
  const index = parseInt(input) - 1;
  
  if (!isNaN(index) && index >= 0 && index < backups.length) {
    selectedBackup = backups[index];
  } else if (backups.includes(input)) {
    selectedBackup = input;
  } else {
    console.log('\n❌ 无效的输入');
    rl.close();
    return;
  }

  const backupPath = path.join(BACKUP_DIR, selectedBackup);
  
  console.log(`\n⚠️  警告: 这将覆盖当前数据库!`);
  const confirm = await prompt(`确认要恢复 "${selectedBackup}" 吗? (输入 "yes" 确认): `);
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('\n❌ 已取消恢复');
    rl.close();
    return;
  }

  // 备份当前数据库
  if (fs.existsSync(DB_PATH)) {
    const currentBackup = path.join(BACKUP_DIR, `genealogy-before-restore-${Date.now()}.db`);
    fs.copyFileSync(DB_PATH, currentBackup);
    console.log(`\n💾 当前数据库已备份到: ${path.basename(currentBackup)}`);
  }

  // 执行恢复
  try {
    fs.copyFileSync(backupPath, DB_PATH);
    console.log('\n✅ 数据库恢复成功!');
    console.log(`📄 已恢复: ${selectedBackup}`);
    console.log(`📂 数据库位置: ${DB_PATH}`);
  } catch (error) {
    console.error('\n❌ 恢复失败:', error);
  }

  rl.close();
}

main();
