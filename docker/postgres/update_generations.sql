-- 从始祖开始递归计算每个人的世代
-- 规则：始祖为第1世，每个人的世代 = 父亲的世代 + 1

-- 1. 首先，找出所有没有父亲的人（可能是始祖或数据有问题的人）
-- 2. 递归计算每个人的世代

-- 查看当前数据情况
-- SELECT COUNT(*) as total, COUNT(DISTINCT father_id) as unique_fathers FROM family_members;

-- 创建临时函数来递归计算世代
DO $$
DECLARE
    max_iterations INTEGER := 100; -- 防止无限循环
    iteration INTEGER := 0;
    updated INTEGER;
    root_generation INTEGER := 1;
BEGIN
    -- 第一步：将所有没有父亲的成员设为始祖（generation = 1）
    UPDATE family_members
    SET generation = root_generation
    WHERE father_id IS NULL AND generation IS DISTINCT FROM root_generation;
    
    GET DIAGNOSTICS updated = ROW_COUNT;
    RAISE NOTICE 'Step 0: Set root members (no father) to generation %: % rows updated', root_generation, updated;
    
    -- 第二步：迭代更新子代的世代
    -- 循环直到没有更新或达到最大迭代次数
    LOOP
        iteration := iteration + 1;
        
        -- 更新那些父亲已经有世代，但自己的世代不等于父亲世代+1的成员
        UPDATE family_members fm
        SET generation = parent.generation + 1
        FROM family_members parent
        WHERE fm.father_id = parent.id
          AND parent.generation IS NOT NULL
          AND (fm.generation IS NULL OR fm.generation != parent.generation + 1);
        
        GET DIAGNOSTICS updated = ROW_COUNT;
        
        RAISE NOTICE 'Iteration %: Updated % rows', iteration, updated;
        
        -- 如果没有更新，退出循环
        EXIT WHEN updated = 0 OR iteration >= max_iterations;
    END LOOP;
    
    RAISE NOTICE 'Total iterations: %, Final update: % rows', iteration, updated;
END $$;

-- 查看更新结果
SELECT 
    generation,
    COUNT(*) as count,
    MIN(name) as example_name
FROM family_members 
WHERE generation IS NOT NULL 
GROUP BY generation 
ORDER BY generation;

-- 查看还有哪些人没有被分配世代（可能是循环引用或孤立节点）
SELECT id, name, father_id, generation 
FROM family_members 
WHERE generation IS NULL;
