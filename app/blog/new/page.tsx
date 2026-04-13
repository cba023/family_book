"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBlogPost, generateSlug } from "../actions";
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
import { ArrowLeft, Save, Eye, Image as ImageIcon, Loader2 } from "lucide-react";
import MarkdownContent from "@/components/markdown-content";
import { ImageUpload } from "@/components/image-upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LoginDialog } from "@/components/login-dialog";
import { checkClientAuth } from "@/app/auth/actions";
import { refreshSessionAfterLogin } from "@/lib/client/refresh-session-after-login";

export default function NewBlogPostPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("published");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { loggedIn } = await checkClientAuth();
      if (!loggedIn) {
        setIsLoggedIn(false);
        setLoginOpen(true);
      } else {
        setIsLoggedIn(true);
      }
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    setLoginOpen(false);
    refreshSessionAfterLogin(router);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    const slug = await generateSlug(title);
    
    const result = await createBlogPost({
      title: title.trim(),
      slug,
      content: content.trim(),
      excerpt: excerpt.trim() || null,
      cover_image: coverImage.trim() || null,
      tags: tags.trim() || null,
      status,
    });

    setIsSubmitting(false);

    if (result.success && result.hash) {
      router.push(`/blog/${result.hash}`);
    } else {
      alert(result.error || "创建失败");
    }
  };

  // 检查登录状态中
  if (isCheckingAuth) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">正在检查登录状态...</p>
        </div>
      </div>
    );
  }

  // 未登录状态
  if (!isLoggedIn) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex justify-between items-center mb-6">
          <Link href="/blog">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回博客
            </Button>
          </Link>
        </div>
        <LoginDialog
          open={loginOpen}
          onOpenChange={setLoginOpen}
          onSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <Link href="/blog">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回博客
          </Button>
        </Link>
        <div className="flex gap-2 lg:hidden">
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
          {/* 编辑区域 */}
          <div className={showPreview ? "hidden lg:block" : ""}>
            <Card>
              <CardHeader>
                <CardTitle>写文章</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">标题 *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="输入文章标题"
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
                    placeholder="简短描述文章内容"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="tags">标签</Label>
                  <Input
                    id="tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="家族历史, 文化传承, 故事（用逗号分隔）"
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
                    placeholder="# 标题

在这里编写文章内容，支持 Markdown 语法...

## 小标题

- 列表项1
- 列表项2

**粗体文字** *斜体文字*

[链接文字](https://example.com)

![本地图片](/uploads/example.jpg)"
                    rows={20}
                    required
                    className="font-mono text-sm"
                  />
                </div>

                <div>
                  <Label>状态</Label>
                  <Select
                    value={status}
                    onValueChange={(v) =>
                      setStatus(v as "draft" | "published")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="published">发布</SelectItem>
                      <SelectItem value="draft">草稿</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || !title.trim() || !content.trim()}
                  className="w-full"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSubmitting ? "保存中..." : "发布文章"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 预览区域 */}
          <div className={showPreview ? "" : "hidden lg:block"}>
            <Card>
              <CardHeader>
                <CardTitle>预览</CardTitle>
              </CardHeader>
              <CardContent>
                {title && (
                  <h1 className="text-3xl font-bold mb-4">{title}</h1>
                )}
                {content ? (
                  <MarkdownContent content={content} />
                ) : (
                  <p className="text-muted-foreground">
                    开始编写内容，预览将显示在这里...
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
