"use client"

import { Menu } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
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
}: {
  children: React.ReactNode;
  /** super_admin / admin：成员列表 */
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}) {
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
          <Link href="/blog" className="w-full cursor-pointer">
            家族博客
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/family-tree" className="w-full cursor-pointer">
              成员列表
            </Link>
          </DropdownMenuItem>
        )}
        {isSuperAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/family-tree/settings/data-maintenance" className="w-full cursor-pointer">
              数据维护
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/family-tree/graph" className="w-full cursor-pointer">
            族谱视图
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/family-tree/statistics" className="w-full cursor-pointer">
            统计分析
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/family-tree/biography-book" className="w-full cursor-pointer">
            生平册
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/family-tree/timeline" className="w-full cursor-pointer">
            时间轴
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
