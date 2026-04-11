"use server";

import { requireUser, numId } from "@/lib/auth/session";
import { formatActionError } from "@/lib/format-action-error";
import { revalidatePath } from "next/cache";

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image: string | null;
  tags: string | null;
  status: "draft" | "published" | "archived";
  view_count: number;
  created_at: string;
  updated_at: string;
}

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
  };
}

export async function generateSlug(title: string): Promise<string> {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 100);
}

export async function fetchBlogPosts(
  status?: "draft" | "published" | "archived",
): Promise<BlogPost[]> {
  const { supabase, user, error: authError } = await requireUser();
  if (!user) {
    console.error("fetchBlogPosts:", authError);
    return [];
  }

  try {
    let q = supabase.from("blog_posts").select("*");
    if (status) {
      q = q.eq("status", status);
    }
    const { data, error } = await q.order("created_at", { ascending: false });

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

export async function fetchBlogPostBySlug(
  slug: string,
): Promise<BlogPost | null> {
  const { supabase, user, error: authError } = await requireUser();
  if (!user) {
    console.error("fetchBlogPostBySlug:", authError);
    return null;
  }

  try {
    const { data: post, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;
    if (!post) return null;

    const { error: upErr } = await supabase
      .from("blog_posts")
      .update({
        view_count: Number(post.view_count ?? 0) + 1,
      })
      .eq("id", numId(post.id));

    if (upErr) console.error("view_count update:", upErr);

    return mapPost(post as Record<string, unknown>);
  } catch (error) {
    console.error("Error fetching blog post:", error);
    return null;
  }
}

export async function fetchBlogPostById(id: number): Promise<BlogPost | null> {
  const { supabase, user, error: authError } = await requireUser();
  if (!user) {
    console.error("fetchBlogPostById:", authError);
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapPost(data as Record<string, unknown>) : null;
  } catch (error) {
    console.error("Error fetching blog post:", error);
    return null;
  }
}

export async function createBlogPost(
  input: CreateBlogInput,
): Promise<{ success: boolean; id?: number; error?: string }> {
  const { supabase, user, error: authError } = await requireUser();
  if (!user) {
    return { success: false, error: authError };
  }

  try {
    const { data: existing } = await supabase
      .from("blog_posts")
      .select("id")
      .eq("slug", input.slug)
      .maybeSingle();

    if (existing) {
      return { success: false, error: "文章链接已存在，请修改标题" };
    }

    const { data, error } = await supabase
      .from("blog_posts")
      .insert({
        user_id: user.id,
        title: input.title,
        slug: input.slug,
        content: input.content,
        excerpt: input.excerpt ?? null,
        cover_image: input.cover_image ?? null,
        tags: input.tags ?? null,
        status: input.status ?? "published",
      })
      .select("id")
      .single();

    if (error) throw error;

    revalidatePath("/blog");
    revalidatePath("/family-tree");

    return { success: true, id: numId(data.id) };
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
    if (input.content !== undefined) patch.content = input.content;
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
  const { supabase, user, error: authError } = await requireUser();
  if (!user) {
    return { success: false, error: authError };
  }

  try {
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
  const { supabase, user, error: authError } = await requireUser();
  if (!user) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("status", "published")
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
  const { supabase, user, error: authError } = await requireUser();
  if (!user) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("tags")
      .eq("status", "published")
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
