import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchBlogPostBySlug } from "../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Calendar, Eye, Tag, Edit } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import MarkdownContent from "@/components/markdown-content";

interface BlogPostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await fetchBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/blog">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回博客列表
          </Button>
        </Link>
      </div>

      <article>
        {post.cover_image && (
          <div className="aspect-video w-full overflow-hidden rounded-lg mb-8">
            <img
              src={post.cover_image}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-4">{post.title}</h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(post.created_at), "yyyy年MM月dd日", {
                locale: zhCN,
              })}
            </div>
            <div className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {post.view_count} 次阅读
            </div>
            <Link href={`/blog/${post.slug}/edit`}>
              <Button variant="ghost" size="sm">
                <Edit className="w-4 h-4 mr-1" />
                编辑
              </Button>
            </Link>
          </div>

          {post.tags && (
            <div className="flex flex-wrap gap-2 mt-4">
              {post.tags.split(",").map((tag) => (
                <Badge key={tag} variant="secondary">
                  <Tag className="w-3 h-3 mr-1" />
                  {tag.trim()}
                </Badge>
              ))}
            </div>
          )}
        </header>

        <Card className="p-8">
          <MarkdownContent content={post.content} />
        </Card>
      </article>
    </div>
  );
}
