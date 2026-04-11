import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  type AppRole,
  parseAppRole,
  canMaintainGenealogy,
} from "@/lib/auth/roles";

export type { AppRole };
export type AuthedSupabase = SupabaseClient;

export async function requireUser(): Promise<
  | { supabase: AuthedSupabase; user: User; error: null }
  | { supabase: AuthedSupabase; user: null; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null, error: "请先登录" };
  }
  return { supabase, user, error: null };
}

/** 读取当前登录用户在 profiles 中的角色（无记录视为 user） */
export async function getUserRole(): Promise<{
  supabase: AuthedSupabase;
  user: User | null;
  role: AppRole | null;
  error: string | null;
}> {
  const base = await requireUser();
  if (!base.user) {
    return {
      supabase: base.supabase,
      user: null,
      role: null,
      error: base.error,
    };
  }
  const { data: profile } = await base.supabase
    .from("profiles")
    .select("role")
    .eq("id", base.user.id)
    .maybeSingle();
  const role = parseAppRole(profile?.role);
  return {
    supabase: base.supabase,
    user: base.user,
    role,
    error: null,
  };
}

/** 族谱数据维护（增删改、批量导入、导出）— super_admin 与 admin */
export async function requireAdmin(): Promise<
  | { supabase: AuthedSupabase; user: User; error: null }
  | { supabase: AuthedSupabase; user: null; error: string }
> {
  const ctx = await getUserRole();
  if (!ctx.user) {
    return { supabase: ctx.supabase, user: null, error: ctx.error ?? "请先登录" };
  }
  if (!canMaintainGenealogy(ctx.role)) {
    return {
      supabase: ctx.supabase,
      user: null,
      error: "需要管理员权限才能进行数据维护",
    };
  }
  return { supabase: ctx.supabase, user: ctx.user, error: null };
}

/** 仅超级管理员：任命/撤销管理员 */
export async function requireSuperAdmin(): Promise<
  | { supabase: AuthedSupabase; user: User; error: null }
  | { supabase: AuthedSupabase; user: null; error: string }
> {
  const ctx = await getUserRole();
  if (!ctx.user) {
    return { supabase: ctx.supabase, user: null, error: ctx.error ?? "请先登录" };
  }
  if (ctx.role !== "super_admin") {
    return {
      supabase: ctx.supabase,
      user: null,
      error: "需要超级管理员权限",
    };
  }
  return { supabase: ctx.supabase, user: ctx.user, error: null };
}

export function numId(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") return parseInt(v, 10);
  return Number(v);
}
