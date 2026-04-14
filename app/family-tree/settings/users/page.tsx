import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/session";
import { getManagedUsers } from "./actions";
import { UserRoleTable } from "./user-role-table";
import { AddUserButton } from "./add-user-button";

export default async function SettingsUsersPage() {
  const gate = await requireSuperAdmin();
  if (!gate.user) {
    redirect("/blog");
  }

  const { users, error } = await getManagedUsers();

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">用户与角色</h1>
        <AddUserButton />
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        超级管理员可新建账号，并可将用户设为「管理员」或「普通用户」。管理员可维护族谱数据，但不能新建账号或改他人角色。
      </p>

      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : (
        <UserRoleTable initialUsers={users} currentUserId={gate.user.id} />
      )}
    </div>
  );
}
