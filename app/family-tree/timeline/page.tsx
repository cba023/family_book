import { Suspense } from "react";
import { fetchMembersForTimeline } from "../actions";
import { TimelineClient } from "./timeline-client";
import { getUserRole } from "@/lib/auth/session";
import { LoginPrompt } from "@/components/login-prompt";

async function TimelineWrapper() {
  const { user } = await getUserRole();

  if (!user) {
    return (
      <div className="w-full h-[calc(100vh-200px)] min-h-[400px] flex items-center justify-center">
        <LoginPrompt message="登录后可查看家族时间轴" />
      </div>
    );
  }

  const { data: members, requireAuth } = await fetchMembersForTimeline();
  return <TimelineClient initialData={members} requireAuth={requireAuth} />;
}

export default function TimelinePage() {
  return (
    <div className="container mx-auto py-6">
       <Suspense fallback={<div className="text-muted-foreground">正在加载时间轴...</div>}>
         <TimelineWrapper />
       </Suspense>
    </div>
  );
}
