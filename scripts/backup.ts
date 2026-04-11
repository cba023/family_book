#!/usr/bin/env tsx
/**
 * 自动备份脚本
 * 
 * 使用方法:
 * 1. 手动运行: npx tsx scripts/backup.ts
 * 2. 添加到 package.json scripts 中
 * 3. 使用 cron/定时任务自动执行
 */

import * as fs from 'fs';
import * as path from 'path';
import { db } from '../lib/db';

// 备份配置
const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MAX_BACKUPS = 30; // 保留最近30个备份

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log('📁 创建备份目录:', BACKUP_DIR);
  }
}

function generateBackupFilename(): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19);
  return `genealogy-backup-${timestamp}.db`;
}

function cleanOldBackups() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('genealogy-backup-') && f.endsWith('.db'))
    .map(f => ({
      name: f,
      path: path.join(BACKUP_DIR, f),
      time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length > MAX_BACKUPS) {
    const toDelete = files.slice(MAX_BACKUPS);
    console.log(`🧹 清理 ${toDelete.length} 个旧备份文件...`);
    
    for (const file of toDelete) {
      fs.unlinkSync(file.path);
      console.log('   删除:', file.name);
    }
  }
}

async function backupDatabase() {
  console.log('🚀 开始备份数据库...\n');

  ensureBackupDir();

  const dbPath = path.join(process.cwd(), 'data', 'genealogy.db');
  const backupFilename = generateBackupFilename();
  const backupPath = path.join(BACKUP_DIR, backupFilename);

  // 检查数据库文件是否存在
  if (!fs.existsSync(dbPath)) {
    console.error('❌ 错误: 数据库文件不存在:', dbPath);
    process.exit(1);
  }

  // better-sqlite3 v12+：backup() 为异步，完成后 resolve
  try {
    await db.backup(backupPath);

    console.log('✅ 备份成功!');
    console.log(`📄 备份文件: ${backupFilename}`);
    
    // 显示文件大小
    const stats = fs.statSync(backupPath);
    const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`📊 文件大小: ${sizeInMB} MB`);
    console.log(`📅 备份时间: ${new Date().toLocaleString('zh-CN')}`);

    // 清理旧备份
    cleanOldBackups();

    // 显示备份列表
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('genealogy-backup-') && f.endsWith('.db'))
      .sort()
      .reverse();
    
    console.log(`\n📦 当前共有 ${backups.length} 个备份文件`);
    console.log('   最新5个:');
    backups.slice(0, 5).forEach((f, i) => {
      const s = fs.statSync(path.join(BACKUP_DIR, f));
      console.log(`   ${i + 1}. ${f} (${(s.size / 1024).toFixed(1)} KB)`);
    });

    return backupPath;
  } catch (error) {
    console.error('❌ 备份失败:', error);
    process.exit(1);
  }
}

// 导出数据到 JSON 格式（额外备份）
function exportToJson() {
  console.log('\n📤 导出 JSON 备份...');
  
  try {
    const data = db.prepare(`
      SELECT * FROM family_members ORDER BY generation, sibling_order
    `).all();

    const exportData = {
      exportDate: new Date().toISOString(),
      totalMembers: data.length,
      members: data
    };

    const jsonFilename = `genealogy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const jsonPath = path.join(BACKUP_DIR, jsonFilename);
    
    fs.writeFileSync(jsonPath, JSON.stringify(exportData, null, 2), 'utf-8');
    
    console.log('✅ JSON 导出成功!');
    console.log(`📄 文件: ${jsonFilename}`);
    
    return jsonPath;
  } catch (error) {
    console.error('❌ JSON 导出失败:', error);
    return null;
  }
}

// 主函数
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('      族谱数据库备份工具');
  console.log('═══════════════════════════════════════\n');

  const backupPath = await backupDatabase();
  const jsonPath = exportToJson();

  console.log('\n═══════════════════════════════════════');
  console.log('      备份完成!');
  console.log('═══════════════════════════════════════');
  console.log(`\n💡 提示:`);
  console.log(`   • 备份文件保存在: ${BACKUP_DIR}`);
  console.log(`   • 最多保留 ${MAX_BACKUPS} 个备份`);
  console.log(`   • 建议定期将备份复制到其他设备或云存储`);
  console.log(`\n🔧 恢复备份:`);
  console.log(`   cp ${backupPath} data/genealogy.db`);
}

main().finally(() => {
  db.close();
});
