import { redirect } from "next/navigation";
import { requireAdminOrSuperAdmin } from "@/lib/auth/session";
import { getVisibleGenerations } from "@/lib/runtime-config";
import { VisibleGenerationsSettings } from "../visible-generations-settings";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function VisibleGenerationsPage() {
  const gate = await requireAdminOrSuperAdmin();
  if (!gate.user) {
    redirect("/blog");
  }

  const visibleGenerations = getVisibleGenerations();

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <Link
        href="/family-tree/settings/data-maintenance"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        返回数据维护
      </Link>

      <h1 className="text-2xl font-bold mb-6">世系图设置</h1>

      <VisibleGenerationsSettings initialValue={visibleGenerations} />
    </div>
  );
}
