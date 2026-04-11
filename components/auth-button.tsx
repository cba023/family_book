"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { LogoutButton } from "./logout-button";
import { LoginDialog } from "./login-dialog";

interface AuthButtonProps {
  user: {
    id: string;
    email?: string | null;
  } | null;
  profile?: {
    role: string | null;
    username: string | null;
  } | null;
}

function getRoleLabel(role: string | null): string {
  switch (role) {
    case "super_admin":
      return "超级管理员";
    case "admin":
      return "管理员";
    default:
      return "用户";
  }
}

function canMaintain(role: string | null): boolean {
  return role === "super_admin" || role === "admin";
}

export function AuthButton({ user, profile }: AuthButtonProps) {
  const [loginOpen, setLoginOpen] = useState(false);

  const handleLoginSuccess = () => {
    // 登录/注册成功后刷新页面，更新为已登录状态
    window.location.reload();
  };

  if (!user) {
    return (
      <>
        <Button size="sm" variant="default" onClick={() => setLoginOpen(true)}>
          登录
        </Button>
        <LoginDialog
          open={loginOpen}
          onOpenChange={setLoginOpen}
          onSuccess={handleLoginSuccess}
        />
      </>
    );
  }

  const role = profile?.role ?? null;
  const roleLabel = getRoleLabel(role);
  const showRoleBadge = role === "super_admin" || role === "admin";
  const username = (profile?.username as string | null)?.trim() ?? "";
  const accountLabel = username || user.email?.split("@")[0] || user.id.slice(0, 8);

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 w-full md:w-auto">
      <span className="text-xs md:text-sm font-medium truncate max-w-[220px] md:max-w-none text-muted-foreground">
        {accountLabel}
        {showRoleBadge ? (
          <span className="hidden sm:inline text-muted-foreground/80">
            {" "}
            · {roleLabel}
          </span>
        ) : null}
      </span>
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        {canMaintain(role) && (
          <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
            <Link href="/family-tree/settings/data-maintenance">用户管理</Link>
          </Button>
        )}
        <LogoutButton className="w-full sm:w-auto" />
      </div>
    </div>
  );
}
