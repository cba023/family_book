-- 游客（anon）与任意登录用户可读：已发布、已归档文章；作者可读自己的草稿；管理员可读全部

DROP POLICY IF EXISTS "blog_posts_select" ON public.blog_posts;

CREATE POLICY "blog_posts_select"
  ON public.blog_posts FOR SELECT
  TO anon, authenticated
  USING (
    (status IN ('published', 'archived'))
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR public.is_admin()
  );

GRANT SELECT ON public.blog_posts TO anon;
