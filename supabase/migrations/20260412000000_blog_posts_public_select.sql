-- 允许匿名用户查看已发布和已归档的博客
DROP POLICY IF EXISTS "blog_posts_select" ON public.blog_posts;

CREATE POLICY "blog_posts_select"
  ON public.blog_posts FOR SELECT
  USING (
    -- 已发布和已归档的文章所有人可见（包括匿名用户）
    status IN ('published', 'archived')
    OR
    -- 草稿只有作者和管理员可见
    (user_id = auth.uid() OR public.is_admin())
  );

-- 允许匿名用户（anon role）读取博客
GRANT SELECT ON public.blog_posts TO anon;
