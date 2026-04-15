import { Suspense } from "react";
import { fetchAllFamilyMembers } from "./actions";
import { FamilyTreeGraph } from "./family-tree-graph";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Box } from "lucide-react";
import { getUserRole } from "@/lib/auth/session";
import { LoginPrompt } from "@/components/login-prompt";

function GraphSkeleton() {
  return (
    <div className="w-full h-[calc(100vh-200px)] min-h-[500px] border rounded-lg bg-muted/20 animate-pulse flex items-center justify-center">
      <div className="text-muted-foreground">加载世系图...</div>
    </div>
  );
}

async function GraphLoader() {
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
      <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
        <p>加载数据失败: {error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    if (totalMemberCount > 0) {
      return (
        <div className="bg-muted/50 text-muted-foreground p-8 rounded-lg text-center space-y-3 max-w-lg mx-auto">
          <p className="text-foreground font-medium">
            世系图只展示<strong>非嫁入</strong>成员
          </p>
          <p>
            当前共有 {totalMemberCount} 条成员记录，但<strong>全部为「嫁入」成员</strong>；世系图节点不包含嫁入成员，因此图中为空。
          </p>
          <p className="text-sm">
            请在「成员列表」中新增<strong>本姓 / 非嫁入</strong>成员，或把需要出现在世系上的人取消「嫁入」标记。
          </p>
        </div>
      );
    }
    return (
      <div className="bg-muted/50 text-muted-foreground p-8 rounded-lg text-center">
        <p>暂无族谱数据，请先添加成员。</p>
      </div>
    );
  }

  return <FamilyTreeGraph initialData={data} />;
}

export default async function FamilyTreeGraphPage() {
  const { user } = await getUserRole();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6">
        <h1 className="text-3xl font-bold">世系图</h1>
        {user && (
          <Button variant="outline" asChild>
            <Link href="/family-tree/graph-3d">
              <Box className="mr-2 h-4 w-4" />
              切换到 3D 视图
            </Link>
          </Button>
        )}
      </div>

      <Suspense fallback={<GraphSkeleton />}>
        <GraphLoader />
      </Suspense>
    </div>
  );
}
