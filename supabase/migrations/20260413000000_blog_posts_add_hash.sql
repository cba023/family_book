-- 为博客文章添加 hash 字段，用于唯一标识文章
-- 保证文章不会重复，删除后 hash 失效

-- 添加 hash 字段
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS hash TEXT UNIQUE;

-- 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_blog_posts_hash ON public.blog_posts(hash);

-- 为现有文章生成 hash（基于标题、内容和创建时间）
UPDATE public.blog_posts 
SET hash = encode(sha256((title || content || created_at::text)::bytea), 'hex')
WHERE hash IS NULL;

-- 修改 RLS 策略，允许通过 hash 访问已发布/归档的文章
DROP POLICY IF EXISTS "blog_posts_select_by_hash" ON public.blog_posts;

-- 更新现有策略，支持 hash 查询
DROP POLICY IF EXISTS "blog_posts_select" ON public.blog_posts;
CREATE POLICY "blog_posts_select"
  ON public.blog_posts FOR SELECT
  TO anon, authenticated
  USING (
    (status IN ('published', 'archived'))
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR public.is_admin()
  );

-- 添加注释
COMMENT ON COLUMN public.blog_posts.hash IS '文章唯一哈希标识，基于标题和内容生成，删除后失效';
