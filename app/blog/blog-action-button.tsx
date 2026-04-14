"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { refreshSessionAfterLogin } from "@/lib/client/refresh-session-after-login";
import { Button } from "@/components/ui/button";
import { Plus, Lock, LogIn } from "lucide-react";
import { LoginDialog } from "@/components/login-dialog";
import { checkClientAuth } from "@/app/auth/actions";

export function BlogActionButton() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [canPost, setCanPost] = useState<boolean | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const result = await checkClientAuth();
      setIsLoggedIn(result.loggedIn);
      setCanPost(result.canPost);
    };
    checkAuth();
  }, []);

  // 加载中不显示任何内容
  if (isLoggedIn === null) {
    return null;
  }

  // 普通用户隐藏写文章按钮
  if (isLoggedIn && !canPost) {
    return null;
  }

  if (isLoggedIn && canPost) {
    return (
      <Link href="/blog/new">
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          写文章
        </Button>
      </Link>
    );
  }

  return (
    <>
      <Button onClick={() => setLoginOpen(true)}>
        <LogIn className="w-4 h-4 mr-2" />
        登录
      </Button>
      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSuccess={() => {
          refreshSessionAfterLogin(router);
          // 刷新页面以获取最新权限
          router.refresh();
        }}
      />
    </>
  );
}