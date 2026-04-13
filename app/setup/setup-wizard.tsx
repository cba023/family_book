"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SetupStep } from "@/lib/setup-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  setupTestConnection,
  setupSaveDatabaseUrl,
  setupApplySchema,
  setupCreateSuperAdmin,
} from "@/app/setup/actions";
import { Loader2 } from "lucide-react";

const DEFAULT_URL =
  "postgresql://postgres:123456@127.0.0.1:5432/mydb";

export function SetupWizard({
  initialStep,
  doneSuccess,
  restartHint,
}: {
  initialStep: SetupStep;
  doneSuccess?: boolean;
  restartHint?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<SetupStep>(initialStep);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [databaseUrl, setDatabaseUrl] = useState(DEFAULT_URL);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!doneSuccess) {
      setStep(initialStep);
    }
  }, [initialStep, doneSuccess]);

  const handleTest = async () => {
    setBusy(true);
    setError(null);
    const r = await setupTestConnection(databaseUrl);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setError(null);
  };

  const handleSaveUrl = async () => {
    setBusy(true);
    setError(null);
    const r = await setupSaveDatabaseUrl(databaseUrl);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setStep("schema");
    router.refresh();
  };

  const handleApplySchema = async () => {
    setBusy(true);
    setError(null);
    const r = await setupApplySchema();
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setStep("admin");
    router.refresh();
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== repeatPassword) {
      setError("两次密码不一致");
      return;
    }
    setBusy(true);
    const r = await setupCreateSuperAdmin({
      username,
      password,
      fullName: fullName || undefined,
      phone: phone || undefined,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    router.push(
      `/setup?done=1&mid=${r.needRestartForMiddleware ? "1" : "0"}`,
    );
  };

  if (doneSuccess) {
    return (
      <div className="mx-auto max-w-lg space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>初始化完成</CardTitle>
            <CardDescription>
              超级管理员已创建，您已自动登录。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {restartHint ? (
              <Alert>
                <AlertTitle>建议重启开发服务器</AlertTitle>
                <AlertDescription>
                  已将 DATABASE_URL 与 AUTH_SECRET 写入{" "}
                  <code className="text-xs">.env.local</code>
                  。请停止并重新执行{" "}
                  <code className="text-xs">npm run dev</code>
                  ，以便中间件能正确校验登录态（未重启前部分受保护路由可能行为异常）。
                </AlertDescription>
              </Alert>
            ) : null}
            <Button className="w-full" onClick={() => router.push("/blog")}>
              进入博客首页
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 p-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">首次启动向导</h1>
        <p className="text-sm text-muted-foreground">
          连接 PostgreSQL → 创建表结构 → 创建超级管理员
        </p>
      </div>

      <div className="flex justify-center gap-2 text-xs text-muted-foreground">
        <span
          className={step === "connection" ? "font-medium text-foreground" : ""}
        >
          ① 数据库
        </span>
        <span>→</span>
        <span
          className={step === "schema" ? "font-medium text-foreground" : ""}
        >
          ② 表结构
        </span>
        <span>→</span>
        <span
          className={step === "admin" ? "font-medium text-foreground" : ""}
        >
          ③ 管理员
        </span>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {step === "connection" ? (
        <Card>
          <CardHeader>
            <CardTitle>连接数据库</CardTitle>
            <CardDescription>
              填写 PostgreSQL 连接串（与 Docker 中账号、库名一致）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dsn">DATABASE_URL</Label>
              <Input
                id="dsn"
                value={databaseUrl}
                onChange={(e) => setDatabaseUrl(e.target.value)}
                className="font-mono text-sm"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={handleTest}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                测试连接
              </Button>
              <Button type="button" disabled={busy} onClick={handleSaveUrl}>
                保存并继续
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "schema" ? (
        <Card>
          <CardHeader>
            <CardTitle>初始化表结构</CardTitle>
            <CardDescription>
              将执行{" "}
              <code className="text-xs">docker/postgres/init.sql</code>
              ，创建应用所需数据表。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled={busy} onClick={handleApplySchema}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              执行建表脚本
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === "admin" ? (
        <Card>
          <CardHeader>
            <CardTitle>创建超级管理员</CardTitle>
            <CardDescription>
              账户名：2～32 位，以小写字母或下划线开头，可含数字。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="su-user">账户名</Label>
                <Input
                  id="su-user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-pass">密码</Label>
                <Input
                  id="su-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-pass2">确认密码</Label>
                <Input
                  id="su-pass2"
                  type="password"
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-fn">姓名（可选）</Label>
                <Input
                  id="su-fn"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-ph">手机（可选）</Label>
                <Input
                  id="su-ph"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                完成初始化
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
