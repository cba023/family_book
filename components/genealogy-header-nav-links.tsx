"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  /** super_admin / admin：可维护族谱数据 */
  canMaintainData: boolean;
  /** 仅 super_admin：管理用户角色 */
  isSuperAdmin: boolean;
  /** 当前高亮路由前缀，用于家族故事页样式 */
  blogActive?: boolean;
  /** 是否已登录 */
  isLoggedIn?: boolean;
};

export function GenealogyHeaderNavLinks({
  canMaintainData,
  isSuperAdmin,
  blogActive = false,
  isLoggedIn = false,
}: Props) {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/blog") {
      return pathname.startsWith("/blog");
    }
    return pathname === path;
  };

  const getLinkClass = (path: string) => {
    return isActive(path)
      ? "text-primary font-semibold border-b-2 border-primary pb-1"
      : "hover:text-primary transition-colors pb-1";
  };

  return (
    <nav className="hidden md:flex items-center justify-center gap-6 text-sm font-medium absolute left-1/2 -translate-x-1/2">
      <Link
        href="/blog"
        className={getLinkClass("/blog")}
      >
        家族故事
      </Link>
      {/* 登录用户都可以看到成员列表，但只有管理员可以编辑 */}
      {isLoggedIn && (
        <Link href="/family-tree" className={getLinkClass("/family-tree")}>
          成员列表
        </Link>
      )}

      <Link href="/family-tree/graph" className={getLinkClass("/family-tree/graph")}>
        世系图
      </Link>
      <Link href="/family-tree/biography-book" className={getLinkClass("/family-tree/biography-book")}>
        生平册
      </Link>
      <Link href="/family-tree/timeline" className={getLinkClass("/family-tree/timeline")}>
        时间轴
      </Link>
      <Link href="/family-tree/statistics" className={getLinkClass("/family-tree/statistics")}>
        数据统计
      </Link>
    </nav>
  );
}
