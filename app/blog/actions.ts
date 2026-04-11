"use server";

import { requireUser, getUserRole, numId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
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

/** 游客与未特指作者均可浏览的文章状态 */
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

// 生成基于内容+时间戳的唯一 hash，确保每篇文章都有唯一标识
function generateContentHash(title: string, content: string): string {
  const timestamp = Date.now();
  const data = `${title}:${content}:${timestamp}`;
  return crypto.createHash("sha256").update(data).digest("hex").substring(0, 16);
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

/** 博客首页列表：已发布 + 已归档（游客可读，依赖 RLS） */
export async function fetchBlogPosts(): Promise<BlogPost[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .in("status", [...PUBLIC_BLOG_STATUSES])
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => mapPost(row as Record<string, unknown>));
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
  const { supabase, user, error: authError } = await requireUser();
  if (!user) {
    return { posts: [], total: 0 };
  }

  try {
    const offset = (page - 1) * pageSize;

    const { count, error: cErr } = await supabase
      .from("blog_posts")
      .select("*", { count: "exact", head: true })
      .eq("status", status);

    if (cErr) throw cErr;

    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    return {
      posts: (data ?? []).map((row) => mapPost(row as Record<string, unknown>)),
      total: count ?? 0,
    };
  } catch (error) {
    console.error("Error fetching blog posts:", error);
    return { posts: [], total: 0 };
  }
}

// 通过 hash 获取文章（主要访问方式）
export async function fetchBlogPostByHash(
  hash: string,
): Promise<BlogPost | null> {
  try {
    const supabase = await createClient();
    const { data: post, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("hash", hash)
      .maybeSingle();

    if (error) throw error;
    if (!post) return null;

    const postStatus = post.status as string;

    // 已发布、已归档：游客可读
    if (postStatus === "published" || postStatus === "archived") {
      // 异步更新浏览数，不阻塞返回
      supabase
        .from("blog_posts")
        .update({
          view_count: Number(post.view_count ?? 0) + 1,
        })
        .eq("id", numId(post.id))
        .then(({ error: upErr }) => {
          if (upErr) console.error("view_count update:", upErr);
        });
      return mapPost(post as Record<string, unknown>);
    }
    
    // 草稿只有作者自己能看
    const { user } = await requireUser();
    if (!user || user.id !== post.user_id) {
      return null;
    }
    
    return mapPost(post as Record<string, unknown>);
  } catch (error) {
    console.error("Error fetching blog post by hash:", error);
    return null;
  }
}

// 兼容旧版：通过 slug 获取文章
export async function fetchBlogPostBySlug(
  slug: string,
): Promise<BlogPost | null> {
  try {
    const supabase = await createClient();
    const { data: post, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;
    if (!post) return null;

    const postStatus = post.status as string;

    // 已发布、已归档：游客可读
    if (postStatus === "published" || postStatus === "archived") {
      // 异步更新浏览数，不阻塞返回
      supabase
        .from("blog_posts")
        .update({
          view_count: Number(post.view_count ?? 0) + 1,
        })
        .eq("id", numId(post.id))
        .then(({ error: upErr }) => {
          if (upErr) console.error("view_count update:", upErr);
        });
      return mapPost(post as Record<string, unknown>);
    }
    
    // 草稿只有作者自己能看
    const { user } = await requireUser();
    if (!user || user.id !== post.user_id) {
      return null;
    }
    
    return mapPost(post as Record<string, unknown>);
  } catch (error) {
    console.error("Error fetching blog post:", error);
    return null;
  }
}

export async function fetchBlogPostById(id: number): Promise<BlogPost | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    
    const postStatus = data.status as string;

    if (postStatus === "published" || postStatus === "archived") {
      return mapPost(data as Record<string, unknown>);
    }
    
    // 草稿只有作者自己能看
    const { user } = await requireUser();
    if (!user || user.id !== data.user_id) {
      return null;
    }
    
    return mapPost(data as Record<string, unknown>);
  } catch (error) {
    console.error("Error fetching blog post:", error);
    return null;
  }
}

export async function createBlogPost(
  input: CreateBlogInput,
): Promise<{ success: boolean; id?: number; hash?: string; error?: string }> {
  const { supabase, user, error: authError } = await requireUser();
  if (!user) {
    return { success: false, error: authError };
  }

  try {
    // 检查 slug 是否已存在
    const { data: existing } = await supabase
      .from("blog_posts")
      .select("id")
      .eq("slug", input.slug)
      .maybeSingle();

    if (existing) {
      return { success: false, error: "文章链接已存在，请修改标题" };
    }

    // 生成内容 hash
    const hash = generateContentHash(input.title, input.content);

    // 检查 hash 是否已存在（内容重复）
    const { data: existingHash } = await supabase
      .from("blog_posts")
      .select("id")
      .eq("hash", hash)
      .maybeSingle();

    if (existingHash) {
      return { success: false, error: "相同内容的文章已存在" };
    }

    const { data, error } = await supabase
      .from("blog_posts")
      .insert({
        user_id: user.id,
        title: input.title,
        slug: input.slug,
        hash,
        content: input.content,
        excerpt: input.excerpt ?? null,
        cover_image: input.cover_image ?? null,
        tags: input.tags ?? null,
        status: input.status ?? "published",
      })
      .select("id, hash")
      .single();

    if (error) throw error;

    revalidatePath("/blog");
    revalidatePath("/family-tree");

    return { success: true, id: numId(data.id), hash: data.hash };
  } catch (error) {
    console.error("Error creating blog post:", error);
    return { success: false, error: formatActionError(error) };
  }
}

export async function updateBlogPost(
  id: number,
  input: Partial<CreateBlogInput>,
): Promise<{ success: boolean; error?: string }> {
  const { supabase, user, error: authError } = await requireUser();
  if (!user) {
    return { success: false, error: authError };
  }

  try {
    // 检查是否是作者
    const { data: existingPost } = await supabase
      .from("blog_posts")
      .select("user_id")
      .eq("id", id)
      .maybeSingle();
    
    if (!existingPost) {
      return { success: false, error: "文章不存在" };
    }
    
    if (existingPost.user_id !== user.id) {
      return { success: false, error: "只能编辑自己的文章" };
    }

    if (input.slug !== undefined) {
      const { data: existing } = await supabase
        .from("blog_posts")
        .select("id")
        .eq("slug", input.slug)
        .neq("id", id)
        .maybeSingle();

      if (existing) {
        return { success: false, error: "文章链接已存在" };
      }
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.title !== undefined) patch.title = input.title;
    if (input.slug !== undefined) patch.slug = input.slug;
    if (input.content !== undefined) {
      patch.content = input.content;
      // 更新内容时重新生成 hash
      patch.hash = generateContentHash(
        (input.title ?? existingPost.title) as string,
        input.content
      );
    }
    if (input.excerpt !== undefined) patch.excerpt = input.excerpt;
    if (input.cover_image !== undefined) patch.cover_image = input.cover_image;
    if (input.tags !== undefined) patch.tags = input.tags;
    if (input.status !== undefined) patch.status = input.status;

    if (Object.keys(patch).length <= 1) {
      return { success: false, error: "没有要更新的字段" };
    }

    const { error } = await supabase
      .from("blog_posts")
      .update(patch)
      .eq("id", id);

    if (error) throw error;

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
  const { supabase, user, role, error: authError } = await getUserRole();
  if (!user) {
    return { success: false, error: authError ?? "请先登录" };
  }

  try {
    // 检查是否是作者
    const { data: existingPost } = await supabase
      .from("blog_posts")
      .select("user_id")
      .eq("id", id)
      .maybeSingle();
    
    if (!existingPost) {
      return { success: false, error: "文章不存在" };
    }
    
    // 管理员可以删除任意博客，普通用户只能删除自己的文章
    const isAdmin = role === "super_admin" || role === "admin";
    if (!isAdmin && existingPost.user_id !== user.id) {
      return { success: false, error: "只能删除自己的文章" };
    }

    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/blog");
    revalidatePath("/family-tree");

    return { success: true };
  } catch (error) {
    console.error("Error deleting blog post:", error);
    return { success: false, error: formatActionError(error) };
  }
}

export async function searchBlogPosts(query: string): Promise<BlogPost[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .in("status", [...PUBLIC_BLOG_STATUSES])
      .order("created_at", { ascending: false });

    if (error) throw error;

    const q = query.trim().toLowerCase();
    if (!q) {
      return (data ?? []).map((row) => mapPost(row as Record<string, unknown>));
    }

    return (data ?? [])
      .filter((row) => {
        const title = String(row.title ?? "").toLowerCase();
        const content = String(row.content ?? "").toLowerCase();
        const tags = String(row.tags ?? "").toLowerCase();
        return (
          title.includes(q) || content.includes(q) || tags.includes(q)
        );
      })
      .map((row) => mapPost(row as Record<string, unknown>));
  } catch (error) {
    console.error("Error searching blog posts:", error);
    return [];
  }
}

export async function fetchBlogTags(): Promise<string[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("blog_posts")
      .select("tags")
      .in("status", [...PUBLIC_BLOG_STATUSES])
      .not("tags", "is", null);

    if (error) throw error;

    const tagSet = new Set<string>();
    (data ?? []).forEach((post) => {
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
