"use server";

import { requireUser, getUserRole, numId } from "@/lib/auth/session";
import { query, queryOne, getPool } from "@/lib/pg";
import { formatActionError } from "@/lib/format-action-error";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  hash: string;
  content: string;
  excerpt: string | null;
  cover_image: string | null;
  tags: string | null;
  status: "draft" | "published" | "archived";
  view_count: number;
  created_at: string;
  updated_at: string;
  user_id?: string;
}

const PUBLIC_BLOG_STATUSES = ["published", "archived"] as const;

export interface CreateBlogInput {
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  cover_image?: string | null;
  tags?: string | null;
  status?: "draft" | "published" | "archived";
}

function mapPost(row: Record<string, unknown>): BlogPost {
  return {
    id: numId(row.id),
    title: String(row.title),
    slug: String(row.slug),
    hash: String(row.hash ?? ""),
    content: String(row.content),
    excerpt: row.excerpt != null ? String(row.excerpt) : null,
    cover_image: row.cover_image != null ? String(row.cover_image) : null,
    tags: row.tags != null ? String(row.tags) : null,
    status: row.status as BlogPost["status"],
    view_count: Number(row.view_count ?? 0),
    created_at:
      row.created_at != null ? String(row.created_at) : new Date().toISOString(),
    updated_at:
      row.updated_at != null ? String(row.updated_at) : new Date().toISOString(),
    user_id: row.user_id != null ? String(row.user_id) : undefined,
  };
}

function generateContentHash(title: string, content: string): string {
  const timestamp = Date.now();
  const data = `${title}:${content}:${timestamp}`;
  return crypto.createHash("sha256").update(data).digest("hex").substring(0, 16);
}

function bumpViewCount(postId: number) {
  void getPool()
    .query(`UPDATE blog_posts SET view_count = view_count + 1 WHERE id = $1`, [
      postId,
    ])
    .catch((err) => console.error("view_count update:", err));
}

export async function generateSlug(title: string): Promise<string> {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 50);
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${baseSlug}-${randomSuffix}`;
}

export async function fetchBlogPosts(): Promise<BlogPost[]> {
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM blog_posts
       WHERE status = ANY($1::text[])
       ORDER BY created_at DESC`,
      [PUBLIC_BLOG_STATUSES],
    );
    return rows.map((row) => mapPost(row));
  } catch (error) {
    console.error("Error fetching blog posts:", error);
    return [];
  }
}

export async function fetchBlogPostsPaginated(
  page: number = 1,
  pageSize: number = 10,
  status: "draft" | "published" | "archived" = "published",
): Promise<{ posts: BlogPost[]; total: number }> {
  const { user, error: authError } = await requireUser();
  if (!user) {
    return { posts: [], total: 0 };
  }

  try {
    const offset = (page - 1) * pageSize;
    const countRow = await queryOne<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM blog_posts WHERE status = $1`,
      [status],
    );
    const total = parseInt(countRow?.n ?? "0", 10);

    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM blog_posts
       WHERE status = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, pageSize, offset],
    );

    return {
      posts: rows.map((row) => mapPost(row)),
      total,
    };
  } catch (error) {
    console.error("Error fetching blog posts:", error);
    return { posts: [], total: 0 };
  }
}

export async function fetchBlogPostByHash(
  hash: string,
): Promise<BlogPost | null> {
  try {
    const post = await queryOne<Record<string, unknown>>(
      `SELECT * FROM blog_posts WHERE hash = $1`,
      [hash],
    );
    if (!post) return null;

    const postStatus = String(post.status);

    if (postStatus === "published" || postStatus === "archived") {
      bumpViewCount(numId(post.id));
      return mapPost(post);
    }

    const { user } = await requireUser();
    if (!user || user.id !== String(post.user_id)) {
      return null;
    }

    return mapPost(post);
  } catch (error) {
    console.error("Error fetching blog post by hash:", error);
    return null;
  }
}

export async function fetchBlogPostBySlug(
  slug: string,
): Promise<BlogPost | null> {
  try {
    const post = await queryOne<Record<string, unknown>>(
      `SELECT * FROM blog_posts WHERE slug = $1`,
      [slug],
    );
    if (!post) return null;

    const postStatus = String(post.status);

    if (postStatus === "published" || postStatus === "archived") {
      bumpViewCount(numId(post.id));
      return mapPost(post);
    }

    const { user } = await requireUser();
    if (!user || user.id !== String(post.user_id)) {
      return null;
    }

    return mapPost(post);
  } catch (error) {
    console.error("Error fetching blog post:", error);
    return null;
  }
}

export async function fetchBlogPostById(id: number): Promise<BlogPost | null> {
  try {
    const data = await queryOne<Record<string, unknown>>(
      `SELECT * FROM blog_posts WHERE id = $1`,
      [id],
    );
    if (!data) return null;

    const postStatus = String(data.status);

    if (postStatus === "published" || postStatus === "archived") {
      return mapPost(data);
    }

    const { user } = await requireUser();
    if (!user || user.id !== String(data.user_id)) {
      return null;
    }

    return mapPost(data);
  } catch (error) {
    console.error("Error fetching blog post:", error);
    return null;
  }
}

export async function createBlogPost(
  input: CreateBlogInput,
): Promise<{ success: boolean; id?: number; hash?: string; error?: string }> {
  const { user, error: authError } = await requireUser();
  if (!user) {
    return { success: false, error: authError };
  }

  try {
    const existing = await queryOne<{ id: number }>(
      `SELECT id FROM blog_posts WHERE slug = $1 LIMIT 1`,
      [input.slug],
    );
    if (existing) {
      return { success: false, error: "文章链接已存在，请修改标题" };
    }

    const hash = generateContentHash(input.title, input.content);

    const existingHash = await queryOne<{ id: number }>(
      `SELECT id FROM blog_posts WHERE hash = $1 LIMIT 1`,
      [hash],
    );
    if (existingHash) {
      return { success: false, error: "相同内容的文章已存在" };
    }

    const row = await queryOne<Record<string, unknown>>(
      `INSERT INTO blog_posts (
        user_id, title, slug, hash, content, excerpt, cover_image, tags, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, hash`,
      [
        user.id,
        input.title,
        input.slug,
        hash,
        input.content,
        input.excerpt ?? null,
        input.cover_image ?? null,
        input.tags ?? null,
        input.status ?? "published",
      ],
    );

    if (!row) {
      return { success: false, error: "创建失败" };
    }

    revalidatePath("/blog");
    revalidatePath("/family-tree");

    return { success: true, id: numId(row.id), hash: String(row.hash ?? "") };
  } catch (error) {
    console.error("Error creating blog post:", error);
    return { success: false, error: formatActionError(error) };
  }
}

type ExistingPostRow = {
  user_id: string;
  title: string;
  content: string;
};

export async function updateBlogPost(
  id: number,
  input: Partial<CreateBlogInput>,
): Promise<{ success: boolean; error?: string }> {
  const { user, error: authError } = await requireUser();
  if (!user) {
    return { success: false, error: authError };
  }

  try {
    const existingPost = await queryOne<ExistingPostRow>(
      `SELECT user_id, title, content FROM blog_posts WHERE id = $1`,
      [id],
    );

    if (!existingPost) {
      return { success: false, error: "文章不存在" };
    }

    if (existingPost.user_id !== user.id) {
      return { success: false, error: "只能编辑自己的文章" };
    }

    const hasAny =
      input.title !== undefined ||
      input.slug !== undefined ||
      input.content !== undefined ||
      input.excerpt !== undefined ||
      input.cover_image !== undefined ||
      input.tags !== undefined ||
      input.status !== undefined;
    if (!hasAny) {
      return { success: false, error: "没有要更新的字段" };
    }

    if (input.slug !== undefined) {
      const existing = await queryOne<{ id: number }>(
        `SELECT id FROM blog_posts WHERE slug = $1 AND id <> $2 LIMIT 1`,
        [input.slug, id],
      );
      if (existing) {
        return { success: false, error: "文章链接已存在" };
      }
    }

    const parts: string[] = [`updated_at = NOW()`];
    const params: unknown[] = [];
    let i = 1;

    if (input.title !== undefined) {
      parts.push(`title = $${i++}`);
      params.push(input.title);
    }
    if (input.slug !== undefined) {
      parts.push(`slug = $${i++}`);
      params.push(input.slug);
    }
    if (input.content !== undefined) {
      const titleForHash = input.title ?? existingPost.title;
      const nextHash = generateContentHash(titleForHash, input.content);
      parts.push(`content = $${i++}`);
      params.push(input.content);
      parts.push(`hash = $${i++}`);
      params.push(nextHash);
    }
    if (input.excerpt !== undefined) {
      parts.push(`excerpt = $${i++}`);
      params.push(input.excerpt);
    }
    if (input.cover_image !== undefined) {
      parts.push(`cover_image = $${i++}`);
      params.push(input.cover_image);
    }
    if (input.tags !== undefined) {
      parts.push(`tags = $${i++}`);
      params.push(input.tags);
    }
    if (input.status !== undefined) {
      parts.push(`status = $${i++}`);
      params.push(input.status);
    }

    params.push(id);
    await getPool().query(
      `UPDATE blog_posts SET ${parts.join(", ")} WHERE id = $${i}`,
      params,
    );

    revalidatePath("/blog");
    revalidatePath("/family-tree");

    return { success: true };
  } catch (error) {
    console.error("Error updating blog post:", error);
    return { success: false, error: formatActionError(error) };
  }
}

export async function deleteBlogPost(
  id: number,
): Promise<{ success: boolean; error?: string }> {
  const { user, role, error: authError } = await getUserRole();
  if (!user) {
    return { success: false, error: authError ?? "请先登录" };
  }

  try {
    const existingPost = await queryOne<{ user_id: string }>(
      `SELECT user_id FROM blog_posts WHERE id = $1`,
      [id],
    );

    if (!existingPost) {
      return { success: false, error: "文章不存在" };
    }

    const isAdmin = role === "super_admin" || role === "admin";
    if (!isAdmin && existingPost.user_id !== user.id) {
      return { success: false, error: "只能删除自己的文章" };
    }

    await getPool().query(`DELETE FROM blog_posts WHERE id = $1`, [id]);

    revalidatePath("/blog");
    revalidatePath("/family-tree");

    return { success: true };
  } catch (error) {
    console.error("Error deleting blog post:", error);
    return { success: false, error: formatActionError(error) };
  }
}

export async function searchBlogPosts(queryStr: string): Promise<BlogPost[]> {
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM blog_posts
       WHERE status = ANY($1::text[])
       ORDER BY created_at DESC`,
      [PUBLIC_BLOG_STATUSES],
    );

    const q = queryStr.trim().toLowerCase();
    if (!q) {
      return rows.map((row) => mapPost(row));
    }

    return rows
      .filter((row) => {
        const title = String(row.title ?? "").toLowerCase();
        const content = String(row.content ?? "").toLowerCase();
        const tags = String(row.tags ?? "").toLowerCase();
        return title.includes(q) || content.includes(q) || tags.includes(q);
      })
      .map((row) => mapPost(row));
  } catch (error) {
    console.error("Error searching blog posts:", error);
    return [];
  }
}

export async function fetchBlogTags(): Promise<string[]> {
  try {
    const rows = await query<{ tags: string | null }>(
      `SELECT tags FROM blog_posts
       WHERE status = ANY($1::text[]) AND tags IS NOT NULL`,
      [PUBLIC_BLOG_STATUSES],
    );

    const tagSet = new Set<string>();
    rows.forEach((post) => {
      if (post.tags) {
        String(post.tags)
          .split(",")
          .forEach((tag) => {
            const trimmed = tag.trim();
            if (trimmed) tagSet.add(trimmed);
          });
      }
    });

    return Array.from(tagSet).sort();
  } catch (error) {
    console.error("Error fetching blog tags:", error);
    return [];
  }
}
