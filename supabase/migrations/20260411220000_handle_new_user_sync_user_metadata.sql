-- 确保新用户触发器把 Auth user_metadata 中的账户名、姓名、手机写入 profiles（含 camelCase 别名）
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
