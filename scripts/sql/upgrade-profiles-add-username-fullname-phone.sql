-- =============================================================================
-- 为 public.profiles 增加账户名、姓名、手机，并更新注册触发器。
-- 若 Adminer 里只看到 id / role / created_at，说明未执行过对应迁移，请在本库执行本脚本一次。
--
-- 用法：
--   1) Adminer：选中数据库 → SQL 命令 → 粘贴全文 → 执行
--   2) 宿主机 psql（容器名按 docker ps 调整）：
--        docker exec -i supabase_db_xxx psql -U postgres -d postgres -f - < scripts/sql/upgrade-profiles-add-username-fullname-phone.sql
--   3) 使用 Supabase CLI：在项目根目录执行 npx supabase db push（会应用 supabase/migrations 下未执行的迁移）
-- =============================================================================

-- 账户名（username）+ 可选姓名、手机；与 Auth 中合成邮箱 account.familybook.local 对应

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- 从现有 auth 邮箱本地部分回填账户名
UPDATE public.profiles p
SET username = lower(split_part(u.email::text, '@', 1))
FROM auth.users u
WHERE p.id = u.id
  AND (p.username IS NULL OR p.username = '');

UPDATE public.profiles
SET username = regexp_replace(username, '[^a-z0-9_]', '_', 'g')
WHERE username IS NOT NULL;

UPDATE public.profiles
SET username = 'u' || username
WHERE username ~ '^[0-9]';

UPDATE public.profiles
SET username = '_' || username
WHERE username IS NOT NULL AND username !~ '^[a-z_]';

-- 兜底账户名须 ≤32 字符（与 profiles_username_format 一致）
UPDATE public.profiles
SET username = 'u' || left(replace(id::text, '-', ''), 12)
WHERE username IS NULL OR username = '';

-- 同名校验前先去重（保留最早 created_at）
WITH ranked AS (
  SELECT
    id,
    username,
    row_number() OVER (
      PARTITION BY lower(username)
      ORDER BY created_at ASC NULLS LAST, id
    ) AS rn
  FROM public.profiles
)
UPDATE public.profiles p
SET username = left(p.username || '_' || replace(p.id::text, '-', ''), 32)
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

-- 已有用户：从 Auth 元数据补姓名、手机（注册时写在 user_metadata 里）
UPDATE public.profiles p
SET
  full_name = CASE
    WHEN p.full_name IS NULL OR btrim(p.full_name) = '' THEN NULLIF(trim(COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'fullName'
    )), '')
    ELSE p.full_name
  END,
  phone = CASE
    WHEN p.phone IS NULL OR btrim(p.phone) = '' THEN NULLIF(trim(COALESCE(
      u.raw_user_meta_data->>'phone',
      u.raw_user_meta_data->>'phone_number'
    )), '')
    ELSE p.phone
  END
FROM auth.users u
WHERE p.id = u.id;

ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;

DROP INDEX IF EXISTS profiles_username_lower_key;
CREATE UNIQUE INDEX profiles_username_lower_key ON public.profiles (lower(username));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (char_length(username) BETWEEN 2 AND 32 AND username ~ '^[a-z_][a-z0-9_]*$');

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
