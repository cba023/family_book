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
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { loggedIn } = await checkClientAuth();
      setIsLoggedIn(loggedIn);
    };
    checkAuth();
  }, []);

  // 加载中不显示任何内容
  if (isLoggedIn === null) {
    return null;
  }

  if (isLoggedIn) {
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
      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSuccess={() => {
          setIsLoggedIn(true);
          refreshSessionAfterLogin(router);
        }}
      />
    </>
  );
}
