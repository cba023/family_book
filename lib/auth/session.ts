import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { queryOne } from "@/lib/pg";
import {
  type AppRole,
  parseAppRole,
  canMaintainGenealogy,
} from "@/lib/auth/roles";

export type { AppRole };

export type SessionUser = {
  id: string;
};

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  return payload?.sub ?? null;
}

export async function requireUser(): Promise<
  | { user: SessionUser; error: null }
  | { user: null; error: string }
> {
  const id = await getSessionUserId();
  if (!id) {
    return { user: null, error: "请先登录" };
  }
  return { user: { id }, error: null };
}

type ProfileRow = {
  role: string;
  username: string;
};

export async function getUserRole(): Promise<{
  user: SessionUser | null;
  role: AppRole | null;
  username: string | null;
  error: string | null;
}> {
  const base = await requireUser();
  if (!base.user) {
    return {
      user: null,
      role: null,
      username: null,
      error: base.error,
    };
  }
  try {
    const profile = await queryOne<ProfileRow>(
      `SELECT role, username FROM profiles WHERE id = $1`,
      [base.user.id],
    );
    const role = parseAppRole(profile?.role);
    return {
      user: base.user,
      role,
      username: profile?.username ?? null,
      error: null,
    };
  } catch (e) {
    console.error("getUserRole: database error", e);
    // 避免 RSC 整页崩溃；会话仍有效但无法读 profiles（多为 DATABASE_URL / 网络 / SSL）
    return {
      user: base.user,
      role: "user",
      username: null,
      error:
        "无法连接数据库，请检查 DATABASE_URL、防火墙及 PostgreSQL 是否允许该主机连接（如 pg_hba.conf）",
    };
  }
}

export async function requireAdmin(): Promise<
  | { user: SessionUser; error: null }
  | { user: null; error: string }
> {
  const ctx = await getUserRole();
  if (!ctx.user) {
    return { user: null, error: ctx.error ?? "请先登录" };
  }
  if (!canMaintainGenealogy(ctx.role)) {
    return {
      user: null,
      error: "需要管理员权限才能进行数据维护",
    };
  }
  return { user: ctx.user, error: null };
}

export async function requireSuperAdmin(): Promise<
  | { user: SessionUser; error: null }
  | { user: null; error: string }
> {
  const ctx = await getUserRole();
  if (!ctx.user) {
    return { user: null, error: ctx.error ?? "请先登录" };
  }
  if (ctx.role !== "super_admin") {
    return { user: null, error: "需要超级管理员权限" };
  }
  return { user: ctx.user, error: null };
}

export async function requireAdminOrSuperAdmin(): Promise<
  | { user: SessionUser; role: AppRole; error: null }
  | { user: null; role: null; error: string }
> {
  const ctx = await getUserRole();
  if (!ctx.user) {
    return { user: null, role: null, error: ctx.error ?? "请先登录" };
  }
  if (!canMaintainGenealogy(ctx.role)) {
    return {
      user: null,
      role: null,
      error: "需要管理员权限才能进行此操作",
    };
  }
  return { user: ctx.user, role: ctx.role as AppRole, error: null };
}

export function numId(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") return parseInt(v, 10);
  return Number(v);
}
