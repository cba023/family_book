import Link from "next/link";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { MobileNav } from "@/components/mobile-nav";
import { GenealogyHeaderNavLinks } from "@/components/genealogy-header-nav-links";
import { FAMILY_SURNAME } from "@/lib/utils";
import { getUserRole } from "@/lib/auth/session";
import { canMaintainGenealogy } from "@/lib/auth/roles";
import { syntheticEmailFromUsername } from "@/lib/auth/account-username";

export async function BlogHeader() {
  const { user, role, username } = await getUserRole();
  const canMaintain = Boolean(user && canMaintainGenealogy(role));
  const isSuperAdmin = Boolean(user && role === "super_admin");

  return (
    <header className="border-b shrink-0 relative">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-semibold text-lg hover:opacity-80 transition-opacity shrink-0 z-10">
          {FAMILY_SURNAME}氏族谱
        </Link>

        <GenealogyHeaderNavLinks
          canMaintainData={canMaintain}
          isSuperAdmin={isSuperAdmin}
          isLoggedIn={Boolean(user)}
        />

        <div className="flex items-center gap-4 shrink-0 z-10">
          <ThemeSwitcher />
          <div className="hidden md:block">
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
          <MobileNav isAdmin={canMaintain} isSuperAdmin={isSuperAdmin} isLoggedIn={Boolean(user)}>
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
          </MobileNav>
        </div>
      </div>
    </header>
  );
}
