import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "登录",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm space-y-6">
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/blog" className="underline underline-offset-4 hover:text-foreground">
            返回家族故事
          </Link>
        </p>
      </div>
    </div>
  );
}
