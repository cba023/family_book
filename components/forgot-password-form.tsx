"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">忘记密码</CardTitle>
          <CardDescription>
            当前为自建 PostgreSQL 登录，系统不发送邮件。请任选以下方式：
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            若您已登录，可在「修改密码」页面直接设置新密码。
          </p>
          <p>
            若无法登录，请联系<strong>超级管理员</strong>在「族谱设置 →
            用户管理」中为您重置密码。
          </p>
          <Button asChild className="w-full" variant="default">
            <Link href="/auth/login">返回登录</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
