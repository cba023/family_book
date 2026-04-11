"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  syntheticEmailFromUsername,
  validateOptionalFullName,
  validateOptionalPhone,
  validateUsernameForRegister,
} from "@/lib/auth/account-username";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("两次密码输入不一致");
      setIsLoading(false);
      return;
    }

    const uCheck = validateUsernameForRegister(username);
    if (!uCheck.ok) {
      setError(uCheck.error);
      setIsLoading(false);
      return;
    }
    const fnCheck = validateOptionalFullName(fullName);
    if (!fnCheck.ok) {
      setError(fnCheck.error);
      setIsLoading(false);
      return;
    }
    const phCheck = validateOptionalPhone(phone);
    if (!phCheck.ok) {
      setError(phCheck.error);
      setIsLoading(false);
      return;
    }

    const data = {
      username: uCheck.username,
      full_name: fnCheck.value ?? "",
      phone: phCheck.value ?? "",
    };

    try {
      const { error } = await supabase.auth.signUp({
        email: syntheticEmailFromUsername(uCheck.username),
        password,
        options: {
          data,
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
      router.push("/auth/sign-up-success");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">注册</CardTitle>
          <CardDescription>
            账户名用于登录，系统不要求、也不收集真实邮箱
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="username">账户名</Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="字母或下划线开头，2～32 位"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="full-name">姓名（选填）</Label>
                <Input
                  id="full-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">手机号（选填）</Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="11 位中国大陆号码"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">密码</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="repeat-password">重复密码</Label>
                </div>
                <Input
                  id="repeat-password"
                  type="password"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "正在创建账户..." : "注册"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              已经有账户了？{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                登录
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
