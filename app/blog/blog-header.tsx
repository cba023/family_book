import Link from "next/link";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { MobileNav } from "@/components/mobile-nav";
import { GenealogyHeaderNavLinks } from "@/components/genealogy-header-nav-links";
import { FAMILY_SURNAME } from "@/lib/utils";
import { getUserRole } from "@/lib/auth/session";
import { canMaintainGenealogy } from "@/lib/auth/roles";

export async function BlogHeader() {
  const { user, role } = await getUserRole();
  const canMaintain = Boolean(user && canMaintainGenealogy(role));
  const isSuperAdmin = Boolean(user && role === "super_admin");

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-semibold text-lg hover:opacity-80 transition-opacity">
          {FAMILY_SURNAME}氏族谱
        </Link>

        <GenealogyHeaderNavLinks
          canMaintainData={canMaintain}
          isSuperAdmin={isSuperAdmin}
          blogActive
        />

        <div className="flex items-center gap-4">
          <ThemeSwitcher />
          <div className="hidden md:block">
            <AuthButton 
              user={user ? { id: user.id, email: user.email } : null}
              profile={user ? { role, username: null } : null}
            />
          </div>
          <MobileNav isAdmin={canMaintain} isSuperAdmin={isSuperAdmin}>
            <AuthButton 
              user={user ? { id: user.id, email: user.email } : null}
              profile={user ? { role, username: null } : null}
            />
          </MobileNav>
        </div>
      </div>
    </header>
  );
}
