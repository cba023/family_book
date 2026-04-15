import { NextRequest, NextResponse } from "next/server";

const SEAWEEDFS_URL = process.env.SEAWEEDFS_URL || "http://192.168.1.8:18888";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    if (!filename) {
      return NextResponse.json(
        { error: "缺少文件名" },
        { status: 400 }
      );
    }

    console.log(`Proxying image from /uploads/: ${filename} -> ${SEAWEEDFS_URL}/images/${filename}`);

    // 转发到 SeaweedFS
    const seaweedResponse = await fetch(`${SEAWEEDFS_URL}/images/${filename}`);

    if (!seaweedResponse.ok) {
      console.error(`File not found in SeaweedFS: ${filename}, status: ${seaweedResponse.status}`);
      return NextResponse.json(
        { error: "文件不存在" },
        { status: 404 }
      );
    }

    // 获取文件内容
    const arrayBuffer = await seaweedResponse.arrayBuffer();
    const headers = new Headers();

    // 复制内容类型
    const contentType = seaweedResponse.headers.get("content-type");
    if (contentType) {
      headers.set("content-type", contentType);
    }

    // 复制其他重要头部
    const contentLength = seaweedResponse.headers.get("content-length");
    if (contentLength) {
      headers.set("content-length", contentLength);
    }

    const lastModified = seaweedResponse.headers.get("last-modified");
    if (lastModified) {
      headers.set("last-modified", lastModified);
    }

    const etag = seaweedResponse.headers.get("etag");
    if (etag) {
      headers.set("etag", etag);
    }

    // 设置缓存
    headers.set("cache-control", "public, max-age=31536000, immutable");

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Upload proxy error:", error);
    return NextResponse.json(
      { error: "代理失败" },
      { status: 500 }
    );
  }
}
