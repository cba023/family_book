"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { refreshSessionAfterLogin } from "@/lib/client/refresh-session-after-login";
import { Lock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginDialog } from "./login-dialog";

interface LoginPromptProps {
  message?: string;
  className?: string;
}

export function LoginPrompt({
  message = "登录后可查看完整内容",
  className = "",
}: LoginPromptProps) {
  const [loginOpen, setLoginOpen] = useState(false);
  const router = useRouter();

  const handleLoginSuccess = () => {
    refreshSessionAfterLogin(router);
  };

  return (
    <>
      <div
        className={`flex flex-col items-center justify-center gap-4 p-8 bg-muted/30 rounded-lg border border-dashed ${className}`}
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
          <Lock className="w-6 h-6 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <Button onClick={() => setLoginOpen(true)} className="gap-2">
          <LogIn className="w-4 h-4" />
          立即登录
        </Button>
      </div>
      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSuccess={handleLoginSuccess}
      />
    </>
  );
}
