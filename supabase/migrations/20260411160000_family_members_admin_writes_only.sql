-- 族谱数据：所有已登录用户可读；仅管理员可增删改（与应用层 requireAdmin 一致）

DROP POLICY IF EXISTS "family_members_select" ON public.family_members;
DROP POLICY IF EXISTS "family_members_insert" ON public.family_members;
DROP POLICY IF EXISTS "family_members_update" ON public.family_members;
DROP POLICY IF EXISTS "family_members_delete" ON public.family_members;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.family_members;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.family_members;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.family_members;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.family_members;

CREATE POLICY "family_members_select"
  ON public.family_members FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "family_members_insert"
  ON public.family_members FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "family_members_update"
  ON public.family_members FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "family_members_delete"
  ON public.family_members FOR DELETE TO authenticated
  USING (public.is_admin());
