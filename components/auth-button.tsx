"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { refreshSessionAfterLogin } from "@/lib/client/refresh-session-after-login";
import Link from "next/link";
import { Button } from "./ui/button";
import { LogoutButton } from "./logout-button";
import { LoginDialog } from "./login-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

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
  const router = useRouter();

  const handleLoginSuccess = () => {
    refreshSessionAfterLogin(router);
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
    <>
      {/* 仅超大屏展开完整账户区；中屏只折叠右侧，中间 Tab 始终平铺 */}
      <div className="hidden 2xl:flex flex-row items-center gap-3 2xl:gap-4 shrink-0">
        <Link
          href="/family-tree/settings/users"
          className="text-sm font-medium truncate max-w-[min(220px,18vw)] hover:text-primary transition-colors"
        >
          {accountLabel}
          {showRoleBadge ? (
            <span className="text-muted-foreground/80"> · {roleLabel}</span>
          ) : null}
        </Link>
        <div className="flex flex-row gap-2 shrink-0">
          {canMaintain(role) && (
            <Button asChild size="sm" variant="outline">
              <Link href="/family-tree/settings/data-maintenance">用户管理</Link>
            </Button>
          )}
          <LogoutButton />
        </div>
      </div>

      {/* 小于 2xl：紧凑账户入口（含小屏始终可见） */}
      <div className="block 2xl:hidden shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 max-w-[min(12rem,calc(100vw-8rem))] sm:max-w-[12rem] gap-1.5 px-1.5 sm:px-2"
              aria-label="账户菜单"
            >
              <User className="h-4 w-4 shrink-0 opacity-80" />
              <span className="truncate text-left">{accountLabel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal leading-snug">
              <div className="truncate font-medium">{accountLabel}</div>
              {showRoleBadge ? (
                <div className="text-xs text-muted-foreground">{roleLabel}</div>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/family-tree/settings/users">账户与资料</Link>
            </DropdownMenuItem>
            {canMaintain(role) ? (
              <DropdownMenuItem asChild>
                <Link href="/family-tree/settings/data-maintenance">用户管理</Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <div className="p-1">
              <LogoutButton className="w-full" />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
