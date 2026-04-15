import { Suspense } from "react";
import { fetchAllFamilyMembers } from "../graph/actions";
import { FamilyForceGraph } from "./force-graph";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";
import { getUserRole } from "@/lib/auth/session";
import { LoginPrompt } from "@/components/login-prompt";

export const metadata: Metadata = {
  title: "世系图 (3D) | Liu Family",
  description: "三维视角的家族世系图",
};

async function Graph3DLoader() {
  const { user } = await getUserRole();

  if (!user) {
    return (
      <div className="w-full h-[calc(100vh-300px)] min-h-[400px] flex items-center justify-center">
        <LoginPrompt message="登录后可查看世系图" />
      </div>
    );
  }

  const { data, error, totalMemberCount = 0 } = await fetchAllFamilyMembers();

  if (error) {
    return (
      <div className="flex items-center justify-center h-[600px] border rounded-lg bg-destructive/10 text-destructive p-4">
        <p>加载数据失败: {error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    if (totalMemberCount > 0) {
      return (
        <div className="flex items-center justify-center min-h-[400px] border rounded-lg bg-muted/50 text-muted-foreground p-8 text-center">
          <div className="space-y-3 max-w-lg">
            <p className="text-foreground font-medium">
              3D 世系图只展示<strong>非嫁入</strong>成员
            </p>
            <p>
              当前共有 {totalMemberCount} 条成员记录，但<strong>全部为「嫁入」成员</strong>；图中不绘制嫁入成员，因此为空。
            </p>
            <p className="text-sm">
              请在「成员列表」中新增本姓成员，或取消需要显示者的「嫁入」标记。
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-[600px] border rounded-lg bg-muted/50 text-muted-foreground p-8 text-center">
        <p>暂无族谱数据，请先添加成员。</p>
      </div>
    );
  }

  return <FamilyForceGraph data={data} />;
}

export default async function FamilyTreeGraph3DPage() {
  const { user } = await getUserRole();

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6">
        <h1 className="text-3xl font-bold">世系图 (3D)</h1>
        {user && (
          <Button variant="outline" asChild>
            <Link href="/family-tree/graph">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              切换到 2D 视图
            </Link>
          </Button>
        )}
      </div>

      <Suspense fallback={
        <div className="w-full h-[600px] border rounded-lg bg-muted/20 animate-pulse flex items-center justify-center">
          <div className="text-muted-foreground">加载族谱数据...</div>
        </div>
      }>
        <Graph3DLoader />
      </Suspense>
    </div>
  );
}
