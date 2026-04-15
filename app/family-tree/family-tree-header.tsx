import Link from "next/link";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { GenealogyHeaderNavLinks } from "@/components/genealogy-header-nav-links";
import { FAMILY_SURNAME } from "@/lib/utils";
import { getUserRole } from "@/lib/auth/session";
import { canMaintainGenealogy } from "@/lib/auth/roles";
import { syntheticEmailFromUsername } from "@/lib/auth/account-username";

export async function FamilyTreeHeader() {
  const { user, role, username } = await getUserRole();
  const canMaintain = Boolean(user && canMaintainGenealogy(role));
  const isSuperAdmin = Boolean(user && role === "super_admin");

  return (
    <header className="border-b shrink-0 relative">
      <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-nowrap items-center gap-2 sm:gap-3 px-4 md:px-6 py-2 min-h-14">
        <Link
          href="/"
          className="shrink-0 font-semibold text-sm sm:text-base md:text-lg hover:opacity-80 transition-opacity max-w-[9rem] sm:max-w-none truncate"
        >
          {FAMILY_SURNAME}氏族谱
        </Link>

        <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] flex justify-center">
          <GenealogyHeaderNavLinks
            canMaintainData={canMaintain}
            isSuperAdmin={isSuperAdmin}
            isLoggedIn={Boolean(user)}
          />
        </div>

        <div className="shrink-0 flex items-center gap-1 sm:gap-2">
          <div className="w-8 shrink-0 flex justify-center">
            <ThemeSwitcher />
          </div>
          <AuthButton
            user={
              user
                ? {
                    id: user.id,
                    email: username
                      ? syntheticEmailFromUsername(username)
                      : null,
                  }
                : null
            }
            profile={user ? { role, username } : null}
          />
        </div>
      </div>
    </header>
  );
}
