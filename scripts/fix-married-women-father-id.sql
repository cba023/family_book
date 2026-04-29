-- 修复：有配偶的女性，移除她们的 father_id
-- 原因：嫁入的女性应该跟随丈夫，不应该有父亲记录

-- 1. 先查看有多少条记录需要修复
SELECT
  COUNT(*) as count,
  string_agg(name, ', ') as names
FROM family_members
WHERE gender = '女'
  AND spouse_ids IS NOT NULL
  AND array_length(spouse_ids, 1) > 0
  AND father_id IS NOT NULL;

-- 2. 执行修复：清空这些女性的 father_id
UPDATE family_members
SET father_id = NULL, updated_at = NOW()
WHERE gender = '女'
  AND spouse_ids IS NOT NULL
  AND array_length(spouse_ids, 1) > 0
  AND father_id IS NOT NULL;

-- 3. 验证结果
SELECT
  COUNT(*) as remaining_count
FROM family_members
WHERE gender = '女'
  AND spouse_ids IS NOT NULL
  AND array_length(spouse_ids, 1) > 0
  AND father_id IS NOT NULL;
