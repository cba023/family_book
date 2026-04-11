-- 用户角色与资料（与 auth.users 一对一）；登录标识为 username，Auth 内使用 用户名@account.familybook.local
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'user')),
  username TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_username_format CHECK (
    char_length(username) BETWEEN 2 AND 32 AND username ~ '^[a-z_][a-z0-9_]*$'
  )
);

CREATE UNIQUE INDEX profiles_username_lower_key ON public.profiles (lower(username));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 判断当前用户是否为管理员（SECURITY DEFINER 避免 RLS 递归）
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

CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

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
    VALUES (NEW.id, 'super_admin', uname, rname, tel);
  ELSE
    INSERT INTO public.profiles (id, role, username, full_name, phone)
    VALUES (NEW.id, 'user', uname, rname, tel);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- 族谱成员（按 user_id 隔离；管理员可访问全部）
CREATE TABLE public.family_members (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  generation INTEGER,
  sibling_order INTEGER,
  father_id BIGINT REFERENCES public.family_members (id) ON DELETE SET NULL,
  gender TEXT CHECK (gender IN ('男', '女')),
  official_position TEXT,
  is_alive BOOLEAN NOT NULL DEFAULT TRUE,
  spouse_id BIGINT REFERENCES public.family_members (id) ON DELETE SET NULL,
  is_married_in BOOLEAN NOT NULL DEFAULT FALSE,
  remarks TEXT,
  birthday TEXT,
  death_date TEXT,
  residence_place TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_family_members_user_id ON public.family_members (user_id);
CREATE INDEX idx_family_members_father_id ON public.family_members (father_id);
CREATE INDEX idx_family_members_generation ON public.family_members (generation);
CREATE INDEX idx_family_members_name ON public.family_members (name);

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- 已登录用户可查看全库族谱；仅管理员可增删改（与 requireAdmin 一致）
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

-- 博客（按 user_id 隔离；slug 在同一用户内唯一）
CREATE TABLE public.blog_posts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  cover_image TEXT,
  tags TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX idx_blog_posts_user_id ON public.blog_posts (user_id);
CREATE INDEX idx_blog_posts_status ON public.blog_posts (status);
CREATE INDEX idx_blog_posts_created ON public.blog_posts (created_at);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

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

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.family_members TO authenticated;
GRANT ALL ON public.blog_posts TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.family_members_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.blog_posts_id_seq TO authenticated;
