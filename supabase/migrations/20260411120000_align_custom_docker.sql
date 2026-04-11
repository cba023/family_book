-- 在已有自定义 Docker 栈（旧表结构、无 profiles）上对齐当前应用所需结构。
-- 可重复执行：使用 IF NOT EXISTS / DROP POLICY IF EXISTS 等（部分需手工处理冲突）。

-- ========== profiles + 管理员判断 + 注册触发器 ==========
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'super_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_by_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_by_super_admin" ON public.profiles;
CREATE POLICY "profiles_update_by_super_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname TEXT;
  rname TEXT;
  tel TEXT;
  cnt INT;
BEGIN
  uname := lower(trim(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email::text, '@', 1))));
  IF uname IS NULL OR uname = '' THEN
    RAISE EXCEPTION 'missing username (user_metadata.username or email local-part)';
  END IF;

  rname := NULLIF(trim(COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'fullName'
  )), '');
  tel := NULLIF(trim(COALESCE(
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'phone_number'
  )), '');

  SELECT COUNT(*)::int INTO cnt FROM public.profiles;

  IF cnt = 0 THEN
    INSERT INTO public.profiles (id, role, username, full_name, phone)
    VALUES (NEW.id, 'super_admin', uname, rname, tel)
    ON CONFLICT (id) DO NOTHING;
  ELSE
    INSERT INTO public.profiles (id, role, username, full_name, phone)
    VALUES (NEW.id, 'user', uname, rname, tel)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

INSERT INTO public.profiles (id, role, username, full_name, phone)
SELECT
  u.id,
  'user',
  COALESCE(
    NULLIF(lower(split_part(COALESCE(u.email::text, ''), '@', 1)), ''),
    'u' || left(replace(u.id::text, '-', ''), 12)
  ),
  NULL,
  NULL
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- ========== family_members：user_id ==========
ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE;

UPDATE public.family_members fm
SET user_id = sub.uid
FROM (
  SELECT id AS uid FROM auth.users ORDER BY created_at ASC NULLS LAST LIMIT 1
) sub
WHERE fm.user_id IS NULL;

ALTER TABLE public.family_members ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON public.family_members (user_id);

-- ========== blog_posts：user_id / status / tags，slug 按用户唯一 ==========
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE;

UPDATE public.blog_posts
SET user_id = COALESCE(
  author_id,
  (SELECT id FROM auth.users ORDER BY created_at ASC NULLS LAST LIMIT 1)
)
WHERE user_id IS NULL;

ALTER TABLE public.blog_posts ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS tags TEXT;

-- status：若仍报错 “column status does not exist”，请再执行 20260411140000_blog_posts_ensure_status.sql
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE public.blog_posts
SET status = CASE WHEN is_published IS TRUE THEN 'published' ELSE 'draft' END
WHERE status IS NULL;

ALTER TABLE public.blog_posts ALTER COLUMN status SET DEFAULT 'published';

ALTER TABLE public.blog_posts DROP CONSTRAINT IF EXISTS blog_posts_status_check;
ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_status_check
  CHECK (status IN ('draft', 'published', 'archived'));

ALTER TABLE public.blog_posts DROP CONSTRAINT IF EXISTS blog_posts_slug_key;
ALTER TABLE public.blog_posts DROP CONSTRAINT IF EXISTS blog_posts_user_slug_key;
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_user_slug_key UNIQUE (user_id, slug);

CREATE INDEX IF NOT EXISTS idx_blog_posts_user_id ON public.blog_posts (user_id);

-- ========== 替换宽松 RLS ==========
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('family_members', 'blog_posts')
      AND policyname LIKE 'Enable %'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

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

CREATE POLICY "blog_posts_select"
  ON public.blog_posts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "blog_posts_insert"
  ON public.blog_posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "blog_posts_update"
  ON public.blog_posts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "blog_posts_delete"
  ON public.blog_posts FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

GRANT ALL ON public.family_members TO authenticated;
GRANT ALL ON public.blog_posts TO authenticated;
