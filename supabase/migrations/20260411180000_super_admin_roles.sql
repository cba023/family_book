-- 角色：super_admin（首个注册用户）、admin（由超管任命，可维护族谱）、user（默认）
-- is_admin()：super_admin 与 admin 均可通过族谱 RLS 写数据
-- is_super_admin()：仅超管可改他人 profiles.role

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

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'user'));

-- 尚无 super_admin 时，将最早注册的账号升为超级管理员（兼容已有库）
UPDATE public.profiles p
SET role = 'super_admin'
WHERE p.id = (
  SELECT id FROM public.profiles ORDER BY created_at ASC NULLS LAST LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'super_admin');

DROP POLICY IF EXISTS "profiles_update_by_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_by_super_admin" ON public.profiles;

CREATE POLICY "profiles_update_by_super_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 首个注册用户 -> super_admin，其余 -> user；与 user_metadata 同步 username / 姓名 / 手机
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
