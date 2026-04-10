"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Image as ImageIcon, X, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  onImageSelect: (url: string) => void;
  className?: string;
}

export function ImageUpload({ onImageSelect, className }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageUrl, setImageUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 显示预览
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        onImageSelect(result.url);
        setImageUrl(result.url);
      } else {
        alert(result.error || "上传失败");
        setPreviewUrl(null);
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("上传失败");
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleUrlSubmit = () => {
    if (imageUrl.trim()) {
      onImageSelect(imageUrl.trim());
      setPreviewUrl(imageUrl.trim());
    }
  };

  const clearPreview = () => {
    setPreviewUrl(null);
    setImageUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* 预览区域 */}
      {previewUrl && (
        <div className="relative rounded-lg border overflow-hidden">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-48 object-contain bg-muted"
          />
          <button
            onClick={clearPreview}
            className="absolute top-2 right-2 p-1 bg-background/80 rounded-full hover:bg-background"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 上传按钮 */}
      <div className="flex gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex-1"
        >
          <Upload className="w-4 h-4 mr-2" />
          {isUploading ? "上传中..." : "上传图片"}
        </Button>
      </div>

      {/* 或者输入 URL */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LinkIcon className="w-4 h-4" />
          <span>或输入图片链接</span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="https://example.com/image.jpg"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleUrlSubmit}
            disabled={!imageUrl.trim()}
          >
            <ImageIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 上传进度 */}
      {isUploading && (
        <div className="space-y-2">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            上传中... {uploadProgress}%
          </p>
        </div>
      )}

      {/* 提示 */}
      <p className="text-xs text-muted-foreground">
        支持 JPG、PNG、GIF、WebP 格式，最大 5MB
      </p>
    </div>
  );
}

export default ImageUpload;
