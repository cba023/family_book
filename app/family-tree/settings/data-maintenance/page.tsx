import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdminOrSuperAdmin } from "@/lib/auth/session";
import { Shield, Users, ArrowRight } from "lucide-react";

export default async function DataMaintenancePage() {
  const gate = await requireAdminOrSuperAdmin();
  if (!gate.user) {
    redirect("/blog");
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">数据维护</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/family-tree/settings/accounts"
          className="flex items-center gap-4 p-6 border rounded-lg hover:bg-muted/50 transition-colors group"
        >
          <div className="p-3 bg-primary/10 rounded-lg">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">账号管理</h2>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {gate.role === "super_admin"
                ? "新建账号、编辑用户信息、修改角色、删除账号"
                : "新建普通用户账号、编辑用户信息、删除普通用户账号"}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-4 p-6 border rounded-lg bg-muted/30">
          <div className="p-3 bg-muted rounded-lg">
            <Shield className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">我的资料</h2>
            <p className="text-sm text-muted-foreground mt-1">
              修改个人资料和密码
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
