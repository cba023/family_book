-- 清除所有成员的配偶信息
UPDATE family_members 
SET spouse_ids = '{}';
