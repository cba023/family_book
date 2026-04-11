import Link from "next/link";
import { Button } from "./ui/button";
import { LogoutButton } from "./logout-button";
import { createClient } from "@/lib/supabase/server";
import { usernameFromAuthSessionUser } from "@/lib/auth/account-username";
import {
  canMaintainGenealogy,
  parseAppRole,
  roleDisplayLabel,
} from "@/lib/auth/roles";

export async function AuthButton() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Button asChild size="sm" variant="default">
        <Link href="/auth/login">登录</Link>
      </Button>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, username")
    .eq("id", user.id)
    .maybeSingle();

  const role = parseAppRole(profile?.role);
  const roleLabel = roleDisplayLabel(role);
  const canMaintain = canMaintainGenealogy(role);
  const username = (profile?.username as string | null)?.trim() ?? "";
  const fromSession = usernameFromAuthSessionUser(user);
  const accountLabel =
    username || fromSession || user.id.slice(0, 8);
  const showRoleBadge = role === "super_admin" || role === "admin";

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
        {canMaintain && (
          <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
            <Link href="/family-tree">数据维护</Link>
          </Button>
        )}
        <LogoutButton className="w-full sm:w-auto" />
      </div>
    </div>
  );
}
