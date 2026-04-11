import Link from "next/link";
import { fetchBlogPosts } from "./actions";
import { getUserRole } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Eye, Plus, Tag } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { BlogEmptyState } from "./blog-empty-state";

export async function BlogPosts() {
  const posts = await fetchBlogPosts();
  const { user } = await getUserRole();

  if (posts.length === 0) {
    return <BlogEmptyState isLoggedIn={!!user} />;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <Link key={post.id} href={`/blog/${post.hash}`}>
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
            {post.cover_image && (
              <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                <img
                  src={post.cover_image}
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={post.status === "published" ? "default" : "secondary"}>
                  {post.status === "published" ? "已发布" : "草稿"}
                </Badge>
                {post.tags && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Tag className="w-3 h-3" />
                    {post.tags.split(",").slice(0, 3).join(", ")}
                  </div>
                )}
              </div>
              <CardTitle className="text-lg line-clamp-2">{post.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {post.excerpt && (
                <p className="text-muted-foreground text-sm line-clamp-3 mb-4">
                  {post.excerpt}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(post.created_at), "yyyy年MM月dd日", {
                    locale: zhCN,
                  })}
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {post.view_count} 次阅读
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
