#!/usr/bin/env node
/**
 * 从始祖开始递归计算每个人的世代
 * 规则：始祖为第1世，每个人的世代 = 父亲的世代 + 1
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:postgres@192.168.1.8:33213/postgres';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('数据库连接成功\n');

    // 查看当前数据情况
    const beforeStats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE generation IS NULL) as null_generation,
        COUNT(*) FILTER (WHERE father_id IS NULL) as no_father
      FROM family_members
    `);
    console.log('当前数据状态:');
    console.log(`  总人数: ${beforeStats.rows[0].total}`);
    console.log(`  世代为NULL: ${beforeStats.rows[0].null_generation}`);
    console.log(`  没有父亲: ${beforeStats.rows[0].no_father}`);
    console.log('');

    // 第一步：将所有没有父亲的成员设为始祖（generation = 1）
    await client.query(`
      UPDATE family_members
      SET generation = 1
      WHERE father_id IS NULL AND (generation IS NULL OR generation != 1)
    `);
    console.log('步骤1: 将没有父亲的成员设为第1世 ✓');

    // 第二步：迭代更新子代的世代
    // 简单粗暴：循环直到没有更新
    let maxIterations = 50;
    let iteration = 0;
    let totalUpdated = 0;

    console.log('\n步骤2: 迭代计算世代...\n');

    while (iteration < maxIterations) {
      iteration++;
      
      // 更新那些父亲已经有世代，但自己的世代不等于父亲世代+1的成员
      const result = await client.query(`
        UPDATE family_members fm
        SET generation = parent.generation + 1
        FROM family_members parent
        WHERE fm.father_id = parent.id
          AND parent.generation IS NOT NULL
          AND (fm.generation IS NULL OR fm.generation != parent.generation + 1)
      `);
      
      if (result.rowCount === 0) {
        break;
      }
      
      totalUpdated += result.rowCount;
      console.log(`  迭代 ${iteration}: 更新了 ${result.rowCount} 条记录`);
    }

    console.log(`\n总共进行了 ${iteration} 次迭代，更新了 ${totalUpdated} 条记录`);

    // 第三步：验证并显示结果
    console.log('\n========== 更新结果 ==========\n');

    const result = await client.query(`
      SELECT 
        generation,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE gender = '男') as male,
        COUNT(*) FILTER (WHERE gender = '女') as female,
        MIN(name) as example_name
      FROM family_members 
      WHERE generation IS NOT NULL 
      GROUP BY generation 
      ORDER BY generation
    `);

    console.log('世代分布:');
    if (result.rows.length === 0) {
      console.log('  没有数据');
    } else {
      result.rows.forEach(r => {
        console.log(`  第${r.generation}世: ${r.count}人 (男${r.male}, 女${r.female}) - 示例: ${r.example_name}`);
      });
    }

    // 检查还有哪些人没有被分配世代
    const nullGen = await client.query(`
      SELECT id, name, father_id, generation 
      FROM family_members 
      WHERE generation IS NULL
      LIMIT 10
    `);

    if (nullGen.rows.length > 0) {
      console.log(`\n⚠️  还有 ${nullGen.rows.length} 人没有被分配世代:`);
      nullGen.rows.forEach(r => {
        console.log(`  ID=${r.id}, name=${r.name}, father_id=${r.father_id}`);
      });
      console.log('\n这些可能是循环引用或数据问题导致的。');
    }

    console.log('\n========== 完成 ==========');

  } catch (error) {
    console.error('错误:', error);
  } finally {
    await client.end();
  }
}

main();
