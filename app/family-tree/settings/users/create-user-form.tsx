"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManagedUser } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

type Props = {
  isSuperAdmin?: boolean;
  onSuccess?: () => void;
};

export function CreateUserForm({ isSuperAdmin = false, onSuccess }: Props = {}) {
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
      if (onSuccess) {
        setTimeout(() => onSuccess(), 500);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
      {isSuperAdmin ? (
        <div className="space-y-2">
          <Label>初始权限</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="initialRole"
                value="user"
                checked={initialRole === "user"}
                onChange={() => setInitialRole("user")}
                disabled={isPending}
                className="accent-primary"
              />
              <span className="text-sm">普通用户</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="initialRole"
                value="admin"
                checked={initialRole === "admin"}
                onChange={() => setInitialRole("admin")}
                disabled={isPending}
                className="accent-primary"
              />
              <span className="text-sm">管理员</span>
            </label>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          将创建为「普通用户」角色
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isPending ? "创建中…" : "创建账号"}
      </Button>
    </form>
  );
}
