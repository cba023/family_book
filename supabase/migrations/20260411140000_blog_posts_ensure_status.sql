-- 旧库仅有 is_published、无 status 时，PostgREST 会报 column does not exist
-- 可重复执行（IF NOT EXISTS / 异常吞掉重复约束）

ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS status TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'blog_posts'
      AND column_name = 'is_published'
  ) THEN
    UPDATE public.blog_posts bp
    SET status = CASE
      WHEN bp.is_published IS TRUE THEN 'published'
      ELSE 'draft'
    END
    WHERE bp.status IS NULL;
  END IF;
END $$;

UPDATE public.blog_posts SET status = 'published' WHERE status IS NULL;

ALTER TABLE public.blog_posts ALTER COLUMN status SET DEFAULT 'published';

DO $$
BEGIN
  ALTER TABLE public.blog_posts
    ADD CONSTRAINT blog_posts_status_check
    CHECK (status IN ('draft', 'published', 'archived'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.blog_posts ALTER COLUMN status SET NOT NULL;
