"use server";

import { requireSuperAdmin } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseAppRole, type AppRole } from "@/lib/auth/roles";
import {
  syntheticEmailFromUsername,
  validateOptionalFullName,
  validateOptionalPhone,
  validateUsernameForRegister,
} from "@/lib/auth/account-username";
import { formatActionError } from "@/lib/format-action-error";
import { revalidatePath } from "next/cache";

export type ManagedUserRow = {
  id: string;
  username: string;
  fullName: string | null;
  phone: string | null;
  role: AppRole;
};

export async function getManagedUsers(): Promise<{
  users: ManagedUserRow[];
  error: string | null;
}> {
  try {
    const gate = await requireSuperAdmin();
    if (!gate.user) {
      return { users: [], error: gate.error };
    }

    const { data: profiles, error: pErr } = await gate.supabase
      .from("profiles")
      .select("id, role, username, full_name, phone")
      .order("username", { ascending: true });
    if (pErr) throw pErr;

    const users: ManagedUserRow[] = (profiles ?? []).map((p) => ({
      id: p.id as string,
      username: (p.username as string) ?? "",
      fullName: (p.full_name as string | null) ?? null,
      phone: (p.phone as string | null) ?? null,
      role: parseAppRole(p.role),
    }));

    return { users, error: null };
  } catch (e) {
    console.error("getManagedUsers", e);
    return { users: [], error: formatActionError(e) };
  }
}

export async function setManagedUserRole(
  targetUserId: string,
  nextRole: "admin" | "user",
): Promise<{ success: boolean; error: string | null }> {
  try {
    const gate = await requireSuperAdmin();
    if (!gate.user) {
      return { success: false, error: gate.error };
    }

    if (targetUserId === gate.user.id) {
      return { success: false, error: "不能修改自己的角色" };
    }

    const { data: targetProfile } = await gate.supabase
      .from("profiles")
      .select("role")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetProfile?.role === "super_admin") {
      return { success: false, error: "不能修改超级管理员账号" };
    }

    if (nextRole !== "admin" && nextRole !== "user") {
      return { success: false, error: "无效角色" };
    }

    const { error } = await gate.supabase
      .from("profiles")
      .update({ role: nextRole })
      .eq("id", targetUserId);

    if (error) throw error;

    revalidatePath("/family-tree/settings/users");
    revalidatePath("/family-tree", "layout");
    revalidatePath("/blog", "layout");
    return { success: true, error: null };
  } catch (e) {
    console.error("setManagedUserRole", e);
    return { success: false, error: formatActionError(e) };
  }
}

export type CreateManagedUserInput = {
  username: string;
  password: string;
  initialRole?: "user" | "admin";
  fullName?: string;
  phone?: string;
};

/** 超级管理员直接创建登录账号（GoTrue 使用合成邮箱 + user_metadata.username） */
export async function createManagedUser(
  input: CreateManagedUserInput,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const gate = await requireSuperAdmin();
    if (!gate.user) {
      return { success: false, error: gate.error };
    }

    const uCheck = validateUsernameForRegister(input.username);
    if (!uCheck.ok) {
      return { success: false, error: uCheck.error };
    }
    const fnCheck = validateOptionalFullName(input.fullName);
    if (!fnCheck.ok) {
      return { success: false, error: fnCheck.error };
    }
    const phCheck = validateOptionalPhone(input.phone);
    if (!phCheck.ok) {
      return { success: false, error: phCheck.error };
    }

    const password = input.password;
    if (!password || password.length < 6) {
      return { success: false, error: "密码至少 6 位" };
    }

    const initialRole = input.initialRole ?? "user";
    if (initialRole !== "user" && initialRole !== "admin") {
      return { success: false, error: "无效角色" };
    }

    const email = syntheticEmailFromUsername(uCheck.username);
    const user_metadata: Record<string, string> = {
      username: uCheck.username,
    };
    if (fnCheck.value) user_metadata.full_name = fnCheck.value;
    if (phCheck.value) user_metadata.phone = phCheck.value;

    const svc = createServiceRoleClient();
    const { data, error } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata,
    });

    if (error) throw error;
    const newId = data.user?.id;
    if (!newId) {
      return { success: false, error: "创建失败：未返回用户 ID" };
    }

    if (initialRole === "admin") {
      const { error: uErr } = await gate.supabase
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", newId);
      if (uErr) throw uErr;
    }

    revalidatePath("/family-tree/settings/users");
    revalidatePath("/family-tree", "layout");
    revalidatePath("/blog", "layout");
    return { success: true, error: null };
  } catch (e) {
    console.error("createManagedUser", e);
    return { success: false, error: formatActionError(e) };
  }
}
