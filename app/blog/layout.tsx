import { Suspense } from "react";
import Link from "next/link";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { MobileNav } from "@/components/mobile-nav";
import { GenealogyHeaderNavLinks } from "@/components/genealogy-header-nav-links";
import { FAMILY_SURNAME } from "@/lib/utils";
import { getUserRole } from "@/lib/auth/session";
import { canMaintainGenealogy } from "@/lib/auth/roles";

export default async function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role } = await getUserRole();
  const canMaintain = Boolean(user && canMaintainGenealogy(role));
  const isSuperAdmin = Boolean(user && role === "super_admin");

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部导航栏 */}
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
              <Suspense fallback={<div className="h-9 w-32 bg-muted animate-pulse rounded-md" />}>
                <AuthButton />
              </Suspense>
            </div>
            <MobileNav isAdmin={canMaintain} isSuperAdmin={isSuperAdmin}>
              <Suspense fallback={<div className="h-9 w-full bg-muted animate-pulse rounded-md" />}>
                <AuthButton />
              </Suspense>
            </MobileNav>
          </div>
        </div>
      </header>

      {/* 页面内容 */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
