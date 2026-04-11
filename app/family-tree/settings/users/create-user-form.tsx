"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManagedUser } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function CreateUserForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [initialRole, setInitialRole] = useState<"user" | "admin">("user");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createManagedUser({
        username,
        password,
        initialRole,
        fullName: fullName || undefined,
        phone: phone || undefined,
      });
      if (!res.success) {
        setMessage(res.error ?? "创建失败");
        return;
      }
      setUsername("");
      setFullName("");
      setPhone("");
      setPassword("");
      setInitialRole("user");
      setMessage("账号已创建");
      router.refresh();
    });
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-lg">新建账号</CardTitle>
        <CardDescription>
          创建账户名与初始密码。可选填姓名与手机号。默认可设为普通用户或管理员。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4 max-w-md">
          {message && (
            <p
              className={
                message === "账号已创建"
                  ? "text-sm text-green-600 dark:text-green-500"
                  : "text-sm text-destructive"
              }
              role="status"
            >
              {message}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="new-username">账户名</Label>
            <Input
              id="new-username"
              type="text"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="字母或下划线开头，2～32 位"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-full-name">姓名（选填）</Label>
            <Input
              id="new-full-name"
              type="text"
              autoComplete="off"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-phone">手机号（选填）</Label>
            <Input
              id="new-phone"
              type="tel"
              autoComplete="off"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11 位中国大陆号码"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">初始密码</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label>初始权限</Label>
            <Select
              value={initialRole}
              onValueChange={(v) => setInitialRole(v as "user" | "admin")}
              disabled={isPending}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">普通用户</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending ? "创建中…" : "创建账号"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
