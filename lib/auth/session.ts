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

export function numId(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") return parseInt(v, 10);
  return Number(v);
}
