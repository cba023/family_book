"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SetupStep } from "@/lib/setup-state";
import type { DatabaseConnectionParts } from "@/app/setup/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  setupTestPostgresLogin,
  setupTestDatabaseParts,
  setupSaveDatabaseFromParts,
  setupApplySchema,
  setupCreateSuperAdmin,
} from "@/app/setup/actions";
import { Loader2 } from "lucide-react";

type ConnectionPhase = 1 | 2 | 3;

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

  const [connPhase, setConnPhase] = useState<ConnectionPhase>(1);
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState("5432");
  const [pgUser, setPgUser] = useState("postgres");
  const [pgPassword, setPgPassword] = useState("");
  const [databaseName, setDatabaseName] = useState("familybook");
  const [createDbIfMissing, setCreateDbIfMissing] = useState(true);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const partsPayload = (): DatabaseConnectionParts => ({
    host,
    port,
    user: pgUser,
    password: pgPassword,
    database: databaseName,
    createDatabaseIfNotExists: createDbIfMissing,
  });

  useEffect(() => {
    if (!doneSuccess) {
      setStep(initialStep);
    }
  }, [initialStep, doneSuccess]);

  const handleTestLogin = async () => {
    setBusy(true);
    setError(null);
    const r = await setupTestPostgresLogin(host, port, pgUser, pgPassword);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setError(null);
  };

  const handleTestTargetDb = async () => {
    setBusy(true);
    setError(null);
    const r = await setupTestDatabaseParts(partsPayload());
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setError(null);
  };

  const handleSaveConnection = async () => {
    setBusy(true);
    setError(null);
    const r = await setupSaveDatabaseFromParts(partsPayload());
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
        <>
          <div className="flex justify-center gap-2 text-[11px] text-muted-foreground">
            <span className={connPhase === 1 ? "font-medium text-foreground" : ""}>
              地址与端口
            </span>
            <span>→</span>
            <span className={connPhase === 2 ? "font-medium text-foreground" : ""}>
              账号密码
            </span>
            <span>→</span>
            <span className={connPhase === 3 ? "font-medium text-foreground" : ""}>
              数据库名
            </span>
          </div>

          {connPhase === 1 ? (
            <Card>
              <CardHeader>
                <CardTitle>PostgreSQL 地址</CardTitle>
                <CardDescription>
                  填写服务器主机名或 IP，以及端口（默认 5432）
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pg-host">主机</Label>
                  <Input
                    id="pg-host"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="127.0.0.1"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pg-port">端口</Label>
                  <Input
                    id="pg-port"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="5432"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
                <Button
                  type="button"
                  className="w-full"
                  disabled={busy}
                  onClick={() => setConnPhase(2)}
                >
                  下一步
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {connPhase === 2 ? (
            <Card>
              <CardHeader>
                <CardTitle>数据库账号</CardTitle>
                <CardDescription>
                  填写用于连接 PostgreSQL 的用户名与密码（非本站登录账号）
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pg-user">用户名</Label>
                  <Input
                    id="pg-user"
                    value={pgUser}
                    onChange={(e) => setPgUser(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pg-pass">密码</Label>
                  <Input
                    id="pg-pass"
                    type="password"
                    value={pgPassword}
                    onChange={(e) => setPgPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setConnPhase(1)}
                  >
                    上一步
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={handleTestLogin}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    测试连接
                  </Button>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => setConnPhase(3)}
                  >
                    下一步
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {connPhase === 3 ? (
            <Card>
              <CardHeader>
                <CardTitle>应用数据库</CardTitle>
                <CardDescription>
                  指定本应用使用的数据库名。若库尚不存在，可勾选由向导尝试创建（需账号具备建库权限）。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pg-db">数据库名</Label>
                  <Input
                    id="pg-db"
                    value={databaseName}
                    onChange={(e) => setDatabaseName(e.target.value)}
                    placeholder="familybook"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    仅允许字母、数字、下划线；不能与系统保留名冲突（勿使用 postgres
                    作为业务库名）。
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="pg-createdb"
                    checked={createDbIfMissing}
                    onCheckedChange={(c) =>
                      setCreateDbIfMissing(c === true)
                    }
                  />
                  <Label
                    htmlFor="pg-createdb"
                    className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    若不存在则尝试创建数据库
                  </Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setConnPhase(2)}
                  >
                    上一步
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={handleTestTargetDb}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    测试连接
                  </Button>
                  <Button type="button" disabled={busy} onClick={handleSaveConnection}>
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    保存并继续
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
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
