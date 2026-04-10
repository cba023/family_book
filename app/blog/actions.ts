"use server";

import { db } from "@/lib/db";
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

// 生成 slug
export async function generateSlug(title: string): Promise<string> {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 100);
}

// 获取所有博客文章
export async function fetchBlogPosts(
  status?: "draft" | "published" | "archived"
): Promise<BlogPost[]> {
  try {
    let query = "SELECT * FROM blog_posts";
    const params: any[] = [];

    if (status) {
      query += " WHERE status = ?";
      params.push(status);
    }

    query += " ORDER BY created_at DESC";

    return db.prepare(query).all(...params) as BlogPost[];
  } catch (error) {
    console.error("Error fetching blog posts:", error);
    return [];
  }
}

// 分页获取博客文章
export async function fetchBlogPostsPaginated(
  page: number = 1,
  pageSize: number = 10,
  status: "draft" | "published" | "archived" = "published"
): Promise<{ posts: BlogPost[]; total: number }> {
  try {
    const offset = (page - 1) * pageSize;

    const totalResult = db
      .prepare("SELECT COUNT(*) as count FROM blog_posts WHERE status = ?")
      .get(status) as { count: number };

    const posts = db
      .prepare(
        "SELECT * FROM blog_posts WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
      )
      .all(status, pageSize, offset) as BlogPost[];

    return { posts, total: totalResult.count };
  } catch (error) {
    console.error("Error fetching blog posts:", error);
    return { posts: [], total: 0 };
  }
}

// 根据 slug 获取博客文章
export async function fetchBlogPostBySlug(
  slug: string
): Promise<BlogPost | null> {
  try {
    const post = db
      .prepare("SELECT * FROM blog_posts WHERE slug = ?")
      .get(slug) as BlogPost | undefined;

    if (post) {
      // 增加浏览次数
      db.prepare(
        "UPDATE blog_posts SET view_count = view_count + 1 WHERE id = ?"
      ).run(post.id);
    }

    return post || null;
  } catch (error) {
    console.error("Error fetching blog post:", error);
    return null;
  }
}

// 根据 ID 获取博客文章
export async function fetchBlogPostById(id: number): Promise<BlogPost | null> {
  try {
    return (
      (db.prepare("SELECT * FROM blog_posts WHERE id = ?").get(id) as
        | BlogPost
        | undefined) || null
    );
  } catch (error) {
    console.error("Error fetching blog post:", error);
    return null;
  }
}

// 创建博客文章
export async function createBlogPost(
  input: CreateBlogInput
): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    // 检查 slug 是否已存在
    const existing = db
      .prepare("SELECT id FROM blog_posts WHERE slug = ?")
      .get(input.slug);

    if (existing) {
      return { success: false, error: "文章链接已存在，请修改标题" };
    }

    const result = db
      .prepare(
        `INSERT INTO blog_posts (title, slug, content, excerpt, cover_image, tags, status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        input.title,
        input.slug,
        input.content,
        input.excerpt || null,
        input.cover_image || null,
        input.tags || null,
        input.status || "published"
      );

    revalidatePath("/blog");
    revalidatePath("/family-tree");

    return { success: true, id: result.lastInsertRowid as number };
  } catch (error) {
    console.error("Error creating blog post:", error);
    return { success: false, error: String(error) };
  }
}

// 更新博客文章
export async function updateBlogPost(
  id: number,
  input: Partial<CreateBlogInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    const fields: string[] = [];
    const values: any[] = [];

    if (input.title !== undefined) {
      fields.push("title = ?");
      values.push(input.title);
    }
    if (input.slug !== undefined) {
      // 检查新 slug 是否与其他文章冲突
      const existing = db
        .prepare("SELECT id FROM blog_posts WHERE slug = ? AND id != ?")
        .get(input.slug, id);
      if (existing) {
        return { success: false, error: "文章链接已存在" };
      }
      fields.push("slug = ?");
      values.push(input.slug);
    }
    if (input.content !== undefined) {
      fields.push("content = ?");
      values.push(input.content);
    }
    if (input.excerpt !== undefined) {
      fields.push("excerpt = ?");
      values.push(input.excerpt);
    }
    if (input.cover_image !== undefined) {
      fields.push("cover_image = ?");
      values.push(input.cover_image);
    }
    if (input.tags !== undefined) {
      fields.push("tags = ?");
      values.push(input.tags);
    }
    if (input.status !== undefined) {
      fields.push("status = ?");
      values.push(input.status);
    }

    if (fields.length === 0) {
      return { success: false, error: "没有要更新的字段" };
    }

    fields.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE blog_posts SET ${fields.join(", ")} WHERE id = ?`).run(
      ...values
    );

    revalidatePath("/blog");
    revalidatePath("/family-tree");

    return { success: true };
  } catch (error) {
    console.error("Error updating blog post:", error);
    return { success: false, error: String(error) };
  }
}

// 删除博客文章
export async function deleteBlogPost(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    db.prepare("DELETE FROM blog_posts WHERE id = ?").run(id);

    revalidatePath("/blog");
    revalidatePath("/family-tree");

    return { success: true };
  } catch (error) {
    console.error("Error deleting blog post:", error);
    return { success: false, error: String(error) };
  }
}

// 搜索博客文章
export async function searchBlogPosts(
  query: string
): Promise<BlogPost[]> {
  try {
    const searchTerm = `%${query}%`;
    return db
      .prepare(
        `SELECT * FROM blog_posts 
         WHERE status = 'published' 
         AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)
         ORDER BY created_at DESC`
      )
      .all(searchTerm, searchTerm, searchTerm) as BlogPost[];
  } catch (error) {
    console.error("Error searching blog posts:", error);
    return [];
  }
}

// 获取标签列表
export async function fetchBlogTags(): Promise<string[]> {
  try {
    const posts = db
      .prepare("SELECT tags FROM blog_posts WHERE status = 'published' AND tags IS NOT NULL")
      .all() as { tags: string }[];

    const tagSet = new Set<string>();
    posts.forEach((post) => {
      post.tags.split(",").forEach((tag) => {
        const trimmed = tag.trim();
        if (trimmed) tagSet.add(trimmed);
      });
    });

    return Array.from(tagSet).sort();
  } catch (error) {
    console.error("Error fetching blog tags:", error);
    return [];
  }
}
