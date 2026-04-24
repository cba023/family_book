import { NextRequest, NextResponse } from "next/server";
import path from "path";

const SEAWEEDFS_URL = process.env.SEAWEEDFS_URL || "http://192.168.1.8:18888";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "没有上传文件" },
        { status: 400 }
      );
    }

    // 验证文件类型
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "只支持 JPG、PNG、GIF、WebP 格式的图片" },
        { status: 400 }
      );
    }

    // 验证文件大小 (最大 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "文件大小不能超过 5MB" },
        { status: 400 }
      );
    }

    // 生成唯一文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.name)?.toLowerCase() || ".jpg";
    const filename = `${timestamp}-${randomStr}${ext}`;

    // 读取文件内容
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 上传到 SeaweedFS
    const seaweedFormData = new FormData();
    const blob = new Blob([buffer], { type: file.type });
    seaweedFormData.append("file", blob, filename);

    const seaweedResponse = await fetch(`${SEAWEEDFS_URL}/images/${filename}`, {
      method: "POST",
      body: seaweedFormData,
    });

    if (!seaweedResponse.ok) {
      console.error("SeaweedFS upload failed:", await seaweedResponse.text());
      return NextResponse.json(
        { error: "上传失败，请检查 SeaweedFS 服务是否正常运行" },
        { status: 500 }
      );
    }

    // 返回 SeaweedFS 的 URL
    const url = `${SEAWEEDFS_URL}/images/${filename}`;

    return NextResponse.json({
      success: true,
      url,
      filename,
      size: file.size,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "上传失败，请检查网络连接" },
      { status: 500 }
    );
  }
}
