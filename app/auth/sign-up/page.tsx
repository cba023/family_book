import type { Metadata } from "next";
import { SignUpForm } from "@/components/sign-up-form";
import { FAMILY_SURNAME } from "@/lib/utils";

export const metadata: Metadata = {
  title: `注册 · ${FAMILY_SURNAME}氏族谱`,
  description: "使用账户名注册，无需填写邮箱；姓名与手机号为选填。",
};

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <header className="text-center text-balance px-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {FAMILY_SURNAME}氏族谱 · 注册
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            仅需账户名与密码，无需填写邮箱；姓名、手机号为选填
          </p>
        </header>
        <SignUpForm />
      </div>
    </div>
  );
}
