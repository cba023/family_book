import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchDescendants } from "./actions";
import { DescendantsTreeGraph } from "./descendants-graph";
import { ChevronLeft } from "lucide-react";
import { getUserRole } from "@/lib/auth/session";
import { LoginPrompt } from "@/components/login-prompt";

function DescendantsSkeleton() {
  return (
    <div className="w-full h-[calc(100vh-200px)] min-h-[500px] border rounded-lg bg-muted/20 animate-pulse flex items-center justify-center">
      <div className="text-muted-foreground">加载后代世系图...</div>
    </div>
  );
}

interface PageProps {
  searchParams: Promise<{ id?: string }>;
}

async function DescendantsLoader({ id }: { id: number }) {
  const { user } = await getUserRole();

  if (!user) {
    return (
      <div className="w-full h-[calc(100vh-300px)] min-h-[400px] flex items-center justify-center">
        <LoginPrompt message="登录后可查看后代世系图" />
      </div>
    );
  }

  const result = await fetchDescendants(id);

  if (result.error || !result.ancestor) {
    return (
      <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
        <p>{result.error || "成员不存在"}</p>
      </div>
    );
  }

  if (result.descendantCount === 0) {
    return (
      <div className="bg-muted/50 text-muted-foreground p-8 rounded-lg text-center">
        <p className="text-foreground font-medium mb-2">{result.ancestor.name} 暂无后代记录</p>
      </div>
    );
  }

  return (
    <DescendantsTreeGraph
      ancestor={result.ancestor}
      descendants={result.data}
      descendantCount={result.descendantCount}
    />
  );
}

export default async function DescendantsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const idStr = params.id;

  if (!idStr) {
    notFound();
  }

  const memberId = parseInt(idStr, 10);

  if (isNaN(memberId)) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6">
        <h1 className="text-3xl font-bold">后代世系图</h1>
      </div>

      <Suspense fallback={<DescendantsSkeleton />}>
        <DescendantsLoader id={memberId} />
      </Suspense>
    </div>
  );
}
