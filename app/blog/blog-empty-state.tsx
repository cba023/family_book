"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Lock, LogIn } from "lucide-react";
import { LoginDialog } from "@/components/login-dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { refreshSessionAfterLogin } from "@/lib/client/refresh-session-after-login";

interface BlogEmptyStateProps {
  isLoggedIn: boolean;
}

export function BlogEmptyState({ isLoggedIn }: BlogEmptyStateProps) {
  const [loginOpen, setLoginOpen] = useState(false);
  const router = useRouter();

  const handleLoginSuccess = () => {
    refreshSessionAfterLogin(router);
  };

  if (isLoggedIn) {
    return (
      <Card className="text-center py-16">
        <CardContent>
          <p className="text-muted-foreground mb-4">还没有家族故事文章</p>
          <Link href="/blog/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              写第一篇文章
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="text-center py-16">
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
            <Lock className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">还没有家族故事文章</p>
            <p className="text-xs text-muted-foreground/70">登录后可发布文章</p>
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
      </CardContent>
    </Card>
  );
}
