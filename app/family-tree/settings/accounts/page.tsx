import { redirect } from "next/navigation";
import { requireAdminOrSuperAdmin } from "@/lib/auth/session";
import { getManagedUsers } from "../users/actions";
import { UserRoleTable } from "../users/user-role-table";
import { AddUserButton } from "../users/add-user-button";

export default async function SettingsAccountsPage() {
  const gate = await requireAdminOrSuperAdmin();
  if (!gate.user) {
    redirect("/blog");
  }

  const { users, error } = await getManagedUsers();

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">账号管理</h1>
        <AddUserButton isSuperAdmin={gate.role === "super_admin"} />
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        超级管理员可新建账号，并可将用户设为「管理员」或「普通用户」。管理员可新建普通用户账号。
      </p>

      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : (
        <UserRoleTable
          initialUsers={users}
          currentUserId={gate.user.id}
          currentUserRole={gate.role}
          isSuperAdmin={gate.role === "super_admin"}
        />
      )}
    </div>
  );
}
