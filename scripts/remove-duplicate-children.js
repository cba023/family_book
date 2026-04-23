#!/usr/bin/env node
/**
 * 处理同一父亲下重名子女的去重问题
 * 规则：保留排行最小（sibling_order 最小）的那个，其他重复的连同其后代一起删除
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:postgres@192.168.1.8:33213/postgres';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('数据库连接成功\n');

    // 1. 找出所有重名的子女（同一父亲下同名）
    const duplicates = await client.query(`
      SELECT father_id, name, COUNT(*) as count, MIN(sibling_order) as min_order
      FROM family_members
      WHERE father_id IS NOT NULL
      GROUP BY father_id, name
      HAVING COUNT(*) > 1
      ORDER BY father_id
    `);

    console.log(`找到 ${duplicates.rows.length} 组重名子女\n`);

    if (duplicates.rows.length === 0) {
      console.log('没有发现重名子女，无需处理');
      await client.end();
      return;
    }

    // 2. 对每组重名进行处理
    let totalRemoved = 0;
    let groupsProcessed = 0;

    await client.query('BEGIN');

    for (const dup of duplicates.rows) {
      const { father_id, name, count, min_order } = dup;

      // 找出这个父亲下所有叫这个名字的子女
      const siblings = await client.query(`
        SELECT id, name, sibling_order, gender, spouse_ids, is_married_in
        FROM family_members
        WHERE father_id = $1 AND name = $2
        ORDER BY sibling_order ASC NULLS LAST
      `, [father_id, name]);

      if (siblings.rows.length <= 1) continue;

      // 保留排行最小的那个
      const toKeep = siblings.rows[0];
      const toRemove = siblings.rows.slice(1);

      console.log(`\n处理 ${name} (父亲ID=${father_id}):`);
      console.log(`  保留: ID=${toKeep.id}, sibling_order=${toKeep.sibling_order}`);
      console.log(`  删除: ${toRemove.map(s => `ID=${s.id} (order=${s.sibling_order})`).join(', ')}`);

      // 对每个要删除的人，递归删除其后代
      for (const sibling of toRemove) {
        const removed = await removeMemberAndDescendants(client, sibling.id);
        totalRemoved += removed;
      }

      groupsProcessed++;
    }

    await client.query('COMMIT');

    console.log(`\n========== 完成 ==========`);
    console.log(`处理了 ${groupsProcessed} 组重名`);
    console.log(`共删除了 ${totalRemoved} 条记录`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('错误:', error);
  } finally {
    await client.end();
  }
}

/**
 * 递归删除成员及其后代
 * 返回删除的记录数
 */
async function removeMemberAndDescendants(client, memberId) {
  // 找出这个人的所有直接子女
  const children = await client.query(`
    SELECT id FROM family_members WHERE father_id = $1
  `, [memberId]);

  let removedCount = 1; // 算上这个人自己

  // 递归删除每个子女及其后代
  for (const child of children.rows) {
    removedCount += await removeMemberAndDescendants(client, child.id);
  }

  // 从丈夫的 spouse_ids 中移除此人
  await client.query(`
    UPDATE family_members
    SET spouse_ids = array_remove(spouse_ids, $1)
    WHERE $1 = ANY(spouse_ids)
  `, [memberId]);

  // 删除此人
  await client.query(`DELETE FROM family_members WHERE id = $1`, [memberId]);

  return removedCount;
}

main();
