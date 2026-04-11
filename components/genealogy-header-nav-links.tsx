import Link from "next/link";

type Props = {
  /** super_admin / admin：可维护族谱数据 */
  canMaintainData: boolean;
  /** 仅 super_admin：管理用户角色 */
  isSuperAdmin: boolean;
  /** 当前高亮路由前缀，用于博客页样式 */
  blogActive?: boolean;
};

export function GenealogyHeaderNavLinks({
  canMaintainData,
  isSuperAdmin,
  blogActive = false,
}: Props) {
  return (
    <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
      <Link
        href="/blog"
        className={
          blogActive
            ? "text-primary font-semibold"
            : "hover:text-primary transition-colors"
        }
      >
        家族博客
      </Link>
      {canMaintainData && (
        <Link href="/family-tree" className="hover:text-primary transition-colors">
          成员列表
        </Link>
      )}

      <Link href="/family-tree/graph" className="hover:text-primary transition-colors">
        族谱视图
      </Link>
      <Link href="/family-tree/statistics" className="hover:text-primary transition-colors">
        统计分析
      </Link>
      <Link href="/family-tree/biography-book" className="hover:text-primary transition-colors">
        生平册
      </Link>
      <Link href="/family-tree/timeline" className="hover:text-primary transition-colors">
        时间轴
      </Link>
    </nav>
  );
}
