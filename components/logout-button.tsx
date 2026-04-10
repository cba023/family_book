"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LogoutButtonProps {
  className?: string;
}

/**
 * 本地模式登出按钮（实际不执行任何操作）
 */
export function LogoutButton({ className }: LogoutButtonProps) {
  // 本地模式下登出按钮不执行任何操作
  return (
    <Button 
      onClick={() => {}} 
      className={cn(className)}
      variant="outline"
      size="sm"
    >
      本地模式
    </Button>
  );
}
