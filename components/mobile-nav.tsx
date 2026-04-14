"use client"

import { Menu } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { usePathname } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function MobileNav({
  children,
  isAdmin = false,
  isSuperAdmin = false,
  isLoggedIn = false,
}: {
  children: React.ReactNode;
  /** super_admin / admin：成员列表 */
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  /** 是否已登录 */
  isLoggedIn?: boolean;
}) {
  const pathname = usePathname()

  const isActive = (path: string) => {
    return pathname === path
  }

  const getLinkClass = (path: string) => {
    return isActive(path)
      ? "w-full cursor-pointer text-primary font-semibold"
      : "w-full cursor-pointer"
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">打开菜单</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/blog" className={getLinkClass("/blog")}>
            家族故事
          </Link>
        </DropdownMenuItem>
        {/* 登录用户都可以看到成员列表 */}
        {isLoggedIn && (
          <DropdownMenuItem asChild>
            <Link href="/family-tree" className={getLinkClass("/family-tree")}>
              成员列表
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/family-tree/graph" className={getLinkClass("/family-tree/graph")}>
            世系图
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/family-tree/biography-book" className={getLinkClass("/family-tree/biography-book")}>
            生平册
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/family-tree/timeline" className={getLinkClass("/family-tree/timeline")}>
            时间轴
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/family-tree/statistics" className={getLinkClass("/family-tree/statistics")}>
            统计分析
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div className="p-2 overflow-x-auto">
          {children}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
