import Link from "next/link";
import { Button } from "./ui/button";

/**
 * 本地模式认证按钮
 * 不需要登录，直接显示数据维护入口
 */
export async function AuthButton() {
  // 本地模式：直接显示已登录状态
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 w-full md:w-auto">
      <span className="text-sm font-medium truncate max-w-[200px] md:max-w-none mb-2 md:mb-0">
        本地模式
      </span>
      <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
        <Button asChild size="sm" variant={"outline"} className="w-full md:w-auto">
          <Link href="/family-tree">数据维护</Link>
        </Button>
      </div>
    </div>
  );
}
