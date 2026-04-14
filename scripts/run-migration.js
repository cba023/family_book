// 运行数据库迁移脚本（添加 spouse_ids 数组列）
const { getPool } = require("./lib/pg");

async function run() {
  const pool = getPool();
  try {
    // 1. 添加 spouse_ids 数组列
    await pool.query(`
      ALTER TABLE family_members
      ADD COLUMN IF NOT EXISTS spouse_ids BIGINT[] DEFAULT '{}'
    `);
    console.log("✓ spouse_ids 列已添加");

    // 2. 从旧的 spouse_id 迁移数据（双向）
    const migrate1 = await pool.query(`
      UPDATE family_members AS fm
      SET spouse_ids = array_append(COALESCE(fm.spouse_ids, '{}'), fm.spouse_id)
      WHERE fm.spouse_id IS NOT NULL
        AND NOT (fm.spouse_id = ANY(COALESCE(fm.spouse_ids, '{}')))
    `);
    console.log(`✓ 迁移步骤1：更新 ${migrate1.rowCount} 条记录（配偶写入）`);

    const migrate2 = await pool.query(`
      UPDATE family_members AS spouse
      SET spouse_ids = array_append(COALESCE(spouse.spouse_ids, '{}'), other.id)
      FROM family_members AS other
      WHERE other.spouse_id = spouse.id
        AND NOT (other.id = ANY(COALESCE(spouse.spouse_ids, '{}')))
    `);
    console.log(`✓ 迁移步骤2：更新 ${migrate2.rowCount} 条记录（反向写入）`);

    console.log("\n迁移完成！");
  } catch (err) {
    console.error("迁移失败:", err.message);
  } finally {
    await pool.end();
  }
}

run();
