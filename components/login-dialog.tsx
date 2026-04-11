"use client";

import { useState, useEffect, useRef } from "react";
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
  validateOptionalFullName,
  validateOptionalPhone,
} from "@/lib/auth/account-username";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ViewMode = "login" | "register";

export function LoginDialog({ open, onOpenChange, onSuccess }: LoginDialogProps) {
  const prefillUsername = process.env.NEXT_PUBLIC_LOGIN_USERNAME ?? "";
  const prefillPassword = process.env.NEXT_PUBLIC_LOGIN_PASSWORD ?? "";

  const [viewMode, setViewMode] = useState<ViewMode>("login");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  // 登录表单状态
  const [loginUsername, setLoginUsername] = useState(prefillUsername);
  const [loginPassword, setLoginPassword] = useState(prefillPassword);

  // 注册表单状态
  const [registerUsername, setRegisterUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 当弹窗关闭时，重置为登录视图
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setViewMode("login");
        resetForm();
        setContentHeight(undefined);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // 测量内容高度
  useEffect(() => {
    if (contentRef.current && !isTransitioning) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [viewMode, isTransitioning, error]);

  const resetForm = () => {
    setError(null);
    setIsLoading(false);
  };

  const switchView = async (mode: ViewMode) => {
    if (mode === viewMode || isTransitioning) return;

    setIsTransitioning(true);

    // 第一阶段：淡出并收缩
    await new Promise(resolve => setTimeout(resolve, 250));

    setViewMode(mode);
    resetForm();

    // 第二阶段：淡入并展开
    setTimeout(() => {
      setIsTransitioning(false);
    }, 50);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    const uCheck = validateUsernameForRegister(loginUsername);
    if (!uCheck.ok) {
      setError(uCheck.error);
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: syntheticEmailFromUsername(uCheck.username),
        password: loginPassword,
      });
      if (error) throw error;

      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "登录失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (registerPassword !== repeatPassword) {
      setError("两次密码输入不一致");
      setIsLoading(false);
      return;
    }

    const uCheck = validateUsernameForRegister(registerUsername);
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
      // 注册
      const { error: signUpError } = await supabase.auth.signUp({
        email: syntheticEmailFromUsername(uCheck.username),
        password: registerPassword,
        options: {
          data,
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (signUpError) throw signUpError;

      // 自动登录
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: syntheticEmailFromUsername(uCheck.username),
        password: registerPassword,
      });
      if (signInError) throw signInError;

      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "注册失败");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[425px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden"
        style={{ 
          height: contentHeight ? `${contentHeight}px` : 'auto',
        }}
      >
        <div 
          ref={contentRef}
          className={`transition-all duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            isTransitioning 
              ? "opacity-0 scale-[0.98] translate-y-1" 
              : "opacity-100 scale-100 translate-y-0"
          }`}
        >
          {viewMode === "login" ? (
            <>
              <DialogHeader>
                <DialogTitle>登录</DialogTitle>
                <DialogDescription>请输入账户名与密码登录</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleLogin} className="space-y-4 pt-4">
                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded animate-in fade-in slide-in-from-top-2 duration-200">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="login-username">账户名</Label>
                  <Input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    placeholder="字母或下划线开头，可含数字"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">密码</Label>
                  </div>
                  <Input
                    id="login-password"
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
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
                <div className="text-center text-sm text-muted-foreground pt-2">
                  还没有账户？{" "}
                  <button
                    type="button"
                    onClick={() => switchView("register")}
                    className="text-primary hover:underline transition-colors duration-200"
                  >
                    立即注册
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>注册</DialogTitle>
                <DialogDescription>仅需账户名与密码，无需填写邮箱</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleRegister} className="space-y-4 pt-4">
                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded animate-in fade-in slide-in-from-top-2 duration-200">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="register-username">账户名</Label>
                  <Input
                    id="register-username"
                    type="text"
                    autoComplete="username"
                    placeholder="字母或下划线开头，2～32 位"
                    required
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full-name">姓名（选填）</Label>
                  <Input
                    id="full-name"
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
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
                <div className="space-y-2">
                  <Label htmlFor="register-password">密码</Label>
                  <Input
                    id="register-password"
                    type="password"
                    required
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repeat-password">重复密码</Label>
                  <Input
                    id="repeat-password"
                    type="password"
                    required
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      注册中...
                    </>
                  ) : (
                    "注册"
                  )}
                </Button>
                <div className="text-center text-sm text-muted-foreground pt-2">
                  已经有账户了？{" "}
                  <button
                    type="button"
                    onClick={() => switchView("login")}
                    className="text-primary hover:underline transition-colors duration-200"
                  >
                    立即登录
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
