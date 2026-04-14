-- 多配偶支持迁移脚本（使用数组字段 spouse_ids）
-- 1. 新增 spouse_ids 数组列
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS spouse_ids BIGINT[] DEFAULT '{}';

-- 2. 从旧的 spouse_id 迁移已有数据（双向写入）
UPDATE family_members AS fm
SET spouse_ids = array_append(COALESCE(fm.spouse_ids, '{}'), fm.spouse_id)
WHERE fm.spouse_id IS NOT NULL
  AND NOT (fm.spouse_id = ANY(COALESCE(fm.spouse_ids, '{}')));

UPDATE family_members AS spouse
SET spouse_ids = array_append(COALESCE(spouse.spouse_ids, '{}'), other.id)
FROM family_members AS other
WHERE other.spouse_id = spouse.id
  AND NOT (other.id = ANY(COALESCE(spouse.spouse_ids, '{}')));

-- 3. 清理旧字段（确认数据一致后再执行）
-- ALTER TABLE family_members DROP COLUMN IF EXISTS spouse_id;
-- ALTER TABLE family_members DROP COLUMN IF EXISTS is_married_in;
