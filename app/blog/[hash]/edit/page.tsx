"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchBlogPostByHash, updateBlogPost } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Eye, Image as ImageIcon } from "lucide-react";
import MarkdownContent from "@/components/markdown-content";
import { ImageUpload } from "@/components/image-upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface EditBlogPostPageProps {
  params: Promise<{
    hash: string;
  }>;
}

export default function EditBlogPostPage({ params }: EditBlogPostPageProps) {
  const router = useRouter();
  const [hash, setHash] = useState<string>("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "archived">("published");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [postId, setPostId] = useState<number>(0);

  useEffect(() => {
    const loadPost = async () => {
      const { hash: paramHash } = await params;
      setHash(paramHash);
      const post = await fetchBlogPostByHash(paramHash);
      if (post) {
        setPostId(post.id);
        setTitle(post.title);
        setContent(post.content);
        setExcerpt(post.excerpt || "");
        setCoverImage(post.cover_image || "");
        setTags(post.tags || "");
        setStatus(post.status);
      }
      setLoading(false);
    };
    loadPost();
  }, [params]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    const result = await updateBlogPost(postId, {
      title: title.trim(),
      content: content.trim(),
      excerpt: excerpt.trim() || null,
      cover_image: coverImage.trim() || null,
      tags: tags.trim() || null,
      status,
    });

    setIsSubmitting(false);

    if (result.success) {
      router.push(`/blog/${hash}`);
    } else {
      alert(result.error || "更新失败");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>加载中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <Link href={`/blog/${hash}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回文章
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="w-4 h-4 mr-2" />
            {showPreview ? "编辑" : "预览"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={showPreview ? "hidden lg:block" : ""}>
            <Card>
              <CardHeader>
                <CardTitle>编辑文章</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">标题 *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label>封面图片</Label>
                  {coverImage && (
                    <div className="mb-2 rounded-lg border overflow-hidden">
                      <img
                        src={coverImage}
                        alt="封面预览"
                        className="w-full h-32 object-cover"
                      />
                    </div>
                  )}
                  <ImageUpload
                    onImageSelect={setCoverImage}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="excerpt">摘要</Label>
                  <Textarea
                    id="excerpt"
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="tags">标签</Label>
                  <Input
                    id="tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label htmlFor="content">内容 * (支持 Markdown)</Label>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm">
                          <ImageIcon className="w-4 h-4 mr-2" />
                          插入图片
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>插入图片</DialogTitle>
                        </DialogHeader>
                        <ImageUpload
                          onImageSelect={(url) => {
                            const imageMarkdown = `\n![图片描述](${url})\n`;
                            setContent((prev) => prev + imageMarkdown);
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={20}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="status">状态</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="published">已发布</SelectItem>
                      <SelectItem value="draft">草稿</SelectItem>
                      <SelectItem value="archived">已归档</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  <Save className="w-4 h-4 mr-2" />
                  {isSubmitting ? "保存中..." : "保存"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className={showPreview ? "" : "hidden lg:block"}>
            <Card>
              <CardHeader>
                <CardTitle>预览</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <h1>{title || "无标题"}</h1>
                  {excerpt && (
                    <p className="text-muted-foreground italic">{excerpt}</p>
                  )}
                  <MarkdownContent content={content} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
