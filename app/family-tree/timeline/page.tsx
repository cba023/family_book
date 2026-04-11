import { Suspense } from "react";
import { fetchMembersForTimeline } from "../actions";
import { TimelineClient } from "./timeline-client";

async function TimelineWrapper() {
  const { data: members, requireAuth } = await fetchMembersForTimeline();
  return <TimelineClient initialData={members} requireAuth={requireAuth} />;
}

export default function TimelinePage() {
  return (
    <div className="container mx-auto py-6">
       <Suspense fallback={<div>Loading timeline...</div>}>
         <TimelineWrapper />
       </Suspense>
    </div>
  );
}
