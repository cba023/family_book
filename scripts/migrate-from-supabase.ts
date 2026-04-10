#!/usr/bin/env tsx
/**
 * 数据迁移脚本：从 Supabase 导出数据到本地 SQLite
 * 
 * 使用方法:
 * 1. 确保 .env.local 中有 Supabase 配置
 * 2. 运行: npx tsx scripts/migrate-from-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import { db, initDatabase } from '../lib/db';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 错误: 请在 .env.local 中配置 Supabase 环境变量');
  process.exit(1);
}

async function migrate() {
  console.log('🚀 开始从 Supabase 迁移数据...\n');

  // 初始化本地数据库
  initDatabase();

  // 创建 Supabase 客户端
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. 获取所有家族成员数据
  console.log('📥 正在从 Supabase 获取数据...');
  const { data: members, error } = await supabase
    .from('family_members')
    .select('*')
    .order('id');

  if (error) {
    console.error('❌ 获取数据失败:', error.message);
    process.exit(1);
  }

  if (!members || members.length === 0) {
    console.log('ℹ️ Supabase 中没有数据，跳过迁移');
    return;
  }

  console.log(`✅ 获取到 ${members.length} 条记录\n`);

  // 2. 清空本地表（如果已有数据）
  console.log('🧹 清空本地数据库...');
  db.prepare('DELETE FROM family_members').run();
  db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run('family_members');

  // 3. 插入数据到 SQLite
  console.log('💾 正在写入本地数据库...\n');

  const insertStmt = db.prepare(`
    INSERT INTO family_members (
      id, name, generation, sibling_order, father_id, gender,
      official_position, is_alive, spouse, remarks, birthday,
      death_date, residence_place, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: any[]) => {
    for (const item of items) {
      insertStmt.run(
        item.id,
        item.name,
        item.generation,
        item.sibling_order,
        item.father_id,
        item.gender,
        item.official_position,
        item.is_alive ? 1 : 0,
        item.spouse,
        item.remarks,
        item.birthday,
        item.death_date,
        item.residence_place,
        item.updated_at || new Date().toISOString()
      );
    }
  });

  insertMany(members);

  // 4. 验证迁移结果
  const result = db.prepare('SELECT COUNT(*) as count FROM family_members').get() as { count: number };
  console.log('✅ 迁移完成！');
  console.log(`📊 成功迁移 ${result.count} 条记录到本地数据库\n`);

  // 5. 显示数据预览
  console.log('📋 数据预览（前5条）:');
  const preview = db.prepare('SELECT id, name, generation, gender FROM family_members LIMIT 5').all();
  console.table(preview);

  // 6. 显示统计信息
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN gender = '男' THEN 1 ELSE 0 END) as male,
      SUM(CASE WHEN gender = '女' THEN 1 ELSE 0 END) as female,
      MAX(generation) as max_generation
    FROM family_members
  `).get();
  
  console.log('\n📈 数据统计:');
  console.log(`   总人数: ${(stats as any).total}`);
  console.log(`   男性: ${(stats as any).male}`);
  console.log(`   女性: ${(stats as any).female}`);
  console.log(`   最大世代: ${(stats as any).max_generation}`);
}

migrate().catch(console.error);
