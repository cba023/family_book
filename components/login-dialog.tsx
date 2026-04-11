"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import {
  syntheticEmailFromUsername,
  validateUsernameForRegister,
} from "@/lib/auth/account-username";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function LoginDialog({ open, onOpenChange, onSuccess }: LoginDialogProps) {
  const prefillUsername = process.env.NEXT_PUBLIC_LOGIN_USERNAME ?? "";
  const prefillPassword = process.env.NEXT_PUBLIC_LOGIN_PASSWORD ?? "";
  const [username, setUsername] = useState(prefillUsername);
  const [password, setPassword] = useState(prefillPassword);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    const uCheck = validateUsernameForRegister(username);
    if (!uCheck.ok) {
      setError(uCheck.error);
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: syntheticEmailFromUsername(uCheck.username),
        password,
      });
      if (error) throw error;
      
      // 登录成功
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "登录失败");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>登录</DialogTitle>
          <DialogDescription>请输入账户名与密码登录</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleLogin} className="space-y-4 pt-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="username">账户名</Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="字母或下划线开头，可含数字"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
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
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                登录中...
              </>
            ) : (
              "登录"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
