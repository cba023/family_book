import { NextRequest, NextResponse } from "next/server";

const SEAWEEDFS_URL = process.env.SEAWEEDFS_URL || "http://192.168.1.8:18888";

// 标记为动态路由，支持静态导出
export const dynamic = "force-dynamic";

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
    const blob = await seaweedResponse.blob();

    // 返回图片
    return new NextResponse(blob, {
      headers: {
        "Content-Type": seaweedResponse.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("代理图片失败:", error);
    return NextResponse.json(
      { error: "获取图片失败" },
      { status: 500 }
    );
  }
}
