import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/session";
import { getManagedUsers } from "../users/actions";
import { UserRoleTable } from "../users/user-role-table";
import { CreateUserForm } from "../users/create-user-form";

export default async function DataMaintenancePage() {
  const gate = await requireSuperAdmin();
  if (!gate.user) {
    redirect("/family-tree/graph");
  }

  const { users, error } = await getManagedUsers();

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <h1 className="text-2xl font-bold mb-2">数据维护</h1>
      <p className="text-muted-foreground text-sm mb-8">
        超级管理员可在此维护系统数据，包括用户账号管理和角色分配。
      </p>

      {/* 用户管理模块 */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 pb-2 border-b">用户管理</h2>
        <p className="text-muted-foreground text-sm mb-6">
          超级管理员可新建账号，并可将用户设为「管理员」或「普通用户」。管理员可维护族谱数据，但不能新建账号或改他人角色。
        </p>

        <CreateUserForm />

        {error ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : (
          <UserRoleTable initialUsers={users} currentUserId={gate.user.id} />
        )}
      </section>
    </div>
  );
}
