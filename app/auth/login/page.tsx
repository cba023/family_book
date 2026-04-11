import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";
import { FAMILY_SURNAME } from "@/lib/utils";
import Image from "next/image";

export const metadata: Metadata = {
  title: `登录 · ${FAMILY_SURNAME}氏族谱`,
  description: "使用账户名与密码登录，无需填写邮箱。",
};

export default function Page() {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center p-6 md:p-10 overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/login-bg.jpg"
          alt=""
          fill
          className="object-cover opacity-80"
          priority
        />
        <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px]" />
      </div>
      <div className="w-full max-w-sm z-10 flex flex-col gap-4">
        <header className="text-center text-balance px-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground drop-shadow-sm">
            {FAMILY_SURNAME}氏族谱
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground drop-shadow-sm">
            使用账户名与密码登录，无需填写邮箱
          </p>
        </header>
        <LoginForm />
      </div>
    </div>
  );
}
