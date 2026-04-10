import { Suspense } from "react";
import { FamilyMembersLoader } from "./family-members-loader";

interface PageProps {
  searchParams: Promise<{ page?: string; search?: string }>;
}

const SKELETON_ROWS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"];

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="h-9 w-64 bg-muted animate-pulse rounded-md" />
        <div className="flex gap-2">
          <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
          <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
        </div>
      </div>
      <div className="border rounded-lg">
        <div className="h-10 bg-muted/50 border-b" />
        {SKELETON_ROWS.map((id) => (
          <div key={id} className="h-12 border-b animate-pulse bg-muted/20" />
        ))}
      </div>
    </div>
  );
}

async function FamilyMembersWrapper({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const search = params.search || "";
  const pageSize = 50;

  return <FamilyMembersLoader page={page} pageSize={pageSize} search={search} />;
}

export default function FamilyTreePage({ searchParams }: PageProps) {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">族谱成员列表</h1>

      <Suspense fallback={<TableSkeleton />}>
        <FamilyMembersWrapper searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
