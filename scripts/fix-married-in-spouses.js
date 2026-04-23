#!/usr/bin/env node
/**
 * 修复嫁入女性的配偶关系
 * 规则：嫁入女性只能有一个配偶，且必须是她丈夫列表中的第一个
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:postgres@192.168.1.8:33213/postgres';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('数据库连接成功\n');

    // 1. 找出所有嫁入女性
    const marriedInWomen = await client.query(`
      SELECT id, name, spouse_ids 
      FROM family_members 
      WHERE gender = '女' AND is_married_in = true
    `);

    console.log(`找到 ${marriedInWomen.rows.length} 位嫁入女性\n`);

    let fixedCount = 0;
    let errorCount = 0;

    for (const woman of marriedInWomen.rows) {
      const spouseIds = woman.spouse_ids || [];
      
      // 找出所有把她放在配偶列表中的男性
      const husbands = await client.query(`
        SELECT id, name, spouse_ids 
        FROM family_members 
        WHERE $1 = ANY(spouse_ids)
      `, [woman.id]);

      if (husbands.rows.length === 0) {
        // 没有任何丈夫把她当配偶 - 清空她的 spouse_ids
        if (spouseIds.length > 0) {
          await client.query(`
            UPDATE family_members SET spouse_ids = '{}' WHERE id = $1
          `, [woman.id]);
          console.log(`  [修复] ${woman.name} (ID=${woman.id}): 没有丈夫把她当配偶，清空spouse_ids`);
          fixedCount++;
        }
      } else if (husbands.rows.length === 1) {
        // 只有一个丈夫 - 正常
        const husband = husbands.rows[0];
        if (spouseIds.length === 0) {
          // 她没有记录丈夫，但丈夫有她 - 修复
          await client.query(`
            UPDATE family_members SET spouse_ids = $1 WHERE id = $2
          `, [[husband.id], woman.id]);
          console.log(`  [修复] ${woman.name} (ID=${woman.id}): 补充记录丈夫 ${husband.name}`);
          fixedCount++;
        } else if (!spouseIds.includes(husband.id)) {
          // 她记录的丈夫和实际不同 - 修正
          await client.query(`
            UPDATE family_members SET spouse_ids = $1 WHERE id = $2
          `, [[husband.id], woman.id]);
          console.log(`  [修复] ${woman.name} (ID=${woman.id}): 修正为丈夫 ${husband.name}`);
          fixedCount++;
        }
        // else: 正常情况，不需要修改
      } else {
        // 有多个丈夫 - 需要修复：只保留第一个
        const primaryHusband = husbands.rows[0];
        
        // 更新她的 spouse_ids 为第一个丈夫
        await client.query(`
          UPDATE family_members SET spouse_ids = $1 WHERE id = $2
        `, [[primaryHusband.id], woman.id]);

        // 从其他丈夫的 spouse_ids 中移除她
        for (const h of husbands.rows.slice(1)) {
          const newSpouseIds = h.spouse_ids.filter(id => id !== woman.id);
          await client.query(`
            UPDATE family_members SET spouse_ids = $1 WHERE id = $2
          `, [newSpouseIds, h.id]);
          console.log(`  [修复] ${woman.name} (ID=${woman.id}): 从 ${h.name} 的配偶列表中移除`);
        }

        console.log(`  [修复] ${woman.name} (ID=${woman.id}): 保留丈夫 ${primaryHusband.name}，从 ${husbands.rows.length - 1} 个其他丈夫中移除`);
        fixedCount++;
      }
    }

    // 2. 验证：确保没有嫁入女性出现在多个男性的配偶列表中
    console.log('\n========== 验证 ==========\n');

    const duplicates = await client.query(`
      WITH spouse_counts AS (
        SELECT spouse_id
        FROM family_members, unnest(spouse_ids) AS spouse_id
        WHERE is_married_in = true
        GROUP BY spouse_id
        HAVING COUNT(*) > 1
      )
      SELECT fm.id, fm.name, fm.spouse_ids, count(*) as appearances
      FROM family_members fm
      JOIN spouse_counts sc ON fm.id = sc.spouse_id
      GROUP BY fm.id, fm.name, fm.spouse_ids
    `);

    if (duplicates.rows.length === 0) {
      console.log('✓ 所有嫁入女性都只出现在一个男性的配偶列表中');
    } else {
      console.log(`✗ 发现 ${duplicates.rows.length} 个问题:`);
      duplicates.rows.forEach(r => {
        console.log(`  ${r.name} (ID=${r.id}): 出现在 ${r.appearances} 个男性的配偶列表中`);
      });
    }

    // 3. 显示统计
    console.log('\n========== 统计 ==========\n');

    const stats = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE gender = '女' AND is_married_in = true) as married_in_women,
        COUNT(*) FILTER (WHERE spouse_ids = '{}') as no_spouse,
        AVG(array_length(spouse_ids, 1)) FILTER (WHERE array_length(spouse_ids, 1) > 0) as avg_spouses
      FROM family_members
    `);

    console.log(`嫁入女性总数: ${stats.rows[0].married_in_women}`);
    console.log(`没有配偶的成员: ${stats.rows[0].no_spouse}`);
    console.log(`平均配偶数: ${parseFloat(stats.rows[0].avg_spouses || 0).toFixed(2)}`);

    console.log(`\n共修复 ${fixedCount} 处问题`);

  } catch (error) {
    console.error('错误:', error);
  } finally {
    await client.end();
  }
}

main();
