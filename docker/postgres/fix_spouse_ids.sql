-- 1. 清理 spouse_ids 数组中的重复元素
UPDATE family_members 
SET spouse_ids = (
  SELECT ARRAY_AGG(DISTINCT elem)
  FROM unnest(spouse_ids) AS elem
);

-- 2. 双向同步：确保 A 在 B 的 spouse_ids 中时，B 也在 A 的 spouse_ids 中
WITH pair_sync AS (
  SELECT 
    fm1.id AS person_id,
    fm2.id AS spouse_person_id
  FROM family_members fm1
  CROSS JOIN LATERAL unnest(fm1.spouse_ids) AS sid
  JOIN family_members fm2 ON fm2.id = sid::bigint
)
UPDATE family_members fm
SET spouse_ids = (
  SELECT ARRAY(
    SELECT DISTINCT uid::bigint 
    FROM (
      SELECT unnest(fm.spouse_ids) AS uid
      UNION
      SELECT ps.spouse_person_id AS uid
      FROM pair_sync ps
      WHERE ps.person_id = fm.id
    ) combined
    ORDER BY uid
  )
)
WHERE EXISTS (
  SELECT 1 FROM pair_sync ps WHERE ps.person_id = fm.id
);
