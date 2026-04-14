"use server";

import { requireSuperAdmin, requireAdminOrSuperAdmin, getUserRole } from "@/lib/auth/session";
import { parseAppRole, type AppRole } from "@/lib/auth/roles";
import {
  validateOptionalFullName,
  validateOptionalPhone,
  validateUsernameForRegister,
} from "@/lib/auth/account-username";
import { formatActionError } from "@/lib/format-action-error";
import { revalidatePath } from "next/cache";
import { hashPassword } from "@/lib/auth/password";
import { withTransaction, query, queryOne, getPool } from "@/lib/pg";

export type ManagedUserRow = {
  id: string;
  username: string;
  fullName: string | null;
  phone: string | null;
  role: AppRole;
};

export async function getManagedUsers(searchQuery?: string): Promise<{
  users: ManagedUserRow[];
  error: string | null;
}> {
  try {
    const gate = await requireAdminOrSuperAdmin();
    if (!gate.user) {
      return { users: [], error: gate.error };
    }

    const term = searchQuery?.trim() ?? "";
    const profiles = await query<{
      id: string;
      role: string;
      username: string;
      full_name: string | null;
      phone: string | null;
    }>(
      `SELECT id, role, username, full_name, phone FROM profiles
       WHERE ($1 = '' OR username ILIKE '%' || $1 || '%' OR full_name ILIKE '%' || $1 || '%' OR phone ILIKE '%' || $1 || '%')
       ORDER BY username ASC`,
      [term],
    );

    const users: ManagedUserRow[] = profiles.map((p) => ({
      id: p.id,
      username: p.username ?? "",
      fullName: p.full_name ?? null,
      phone: p.phone ?? null,
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

    const tr = await queryOne<{ role: string }>(
      `SELECT role FROM profiles WHERE id = $1`,
      [targetUserId],
    );
    if (!tr) {
      return { success: false, error: "用户不存在" };
    }
    if (tr.role === "super_admin") {
      return { success: false, error: "不能修改超级管理员账号" };
    }

    if (nextRole !== "admin" && nextRole !== "user") {
      return { success: false, error: "无效角色" };
    }

    await getPool().query(`UPDATE profiles SET role = $1 WHERE id = $2`, [
      nextRole,
      targetUserId,
    ]);

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

export async function createManagedUser(
  input: CreateManagedUserInput,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const gate = await requireAdminOrSuperAdmin();
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

    // 管理员只能创建普通用户
    let initialRole: "user" | "admin" = "user";
    if (gate.role === "super_admin" && input.initialRole) {
      initialRole = input.initialRole;
    }
    // 管理员只能创建 user
    if (gate.role === "admin") {
      initialRole = "user";
    }

    await withTransaction(async (client) => {
      const hash = await hashPassword(password);
      const { rows: uRows } = await client.query<{ id: string }>(
        `INSERT INTO app_users (password_hash) VALUES ($1) RETURNING id`,
        [hash],
      );
      const newId = uRows[0]?.id;
      if (!newId) throw new Error("创建用户失败");

      await client.query(
        `INSERT INTO profiles (id, role, username, full_name, phone)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          newId,
          initialRole,
          uCheck.username,
          fnCheck.value,
          phCheck.value,
        ],
      );
    });

    revalidatePath("/family-tree/settings/users");
    revalidatePath("/family-tree", "layout");
    revalidatePath("/blog", "layout");
    return { success: true, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      typeof msg === "string" &&
      msg.includes("profiles_username_lower_key")
    ) {
      return { success: false, error: "该账户名已被使用" };
    }
    console.error("createManagedUser", e);
    return { success: false, error: formatActionError(e) };
  }
}

/** 超级管理员重置指定用户密码 */
export async function resetManagedUserPassword(
  targetUserId: string,
  newPassword: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const gate = await requireSuperAdmin();
    if (!gate.user) {
      return { success: false, error: gate.error };
    }
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: "密码至少 6 位" };
    }
    const hash = await hashPassword(newPassword);
    const r = await getPool().query(
      `UPDATE app_users SET password_hash = $1 WHERE id = $2`,
      [hash, targetUserId],
    );
    if (r.rowCount === 0) {
      return { success: false, error: "用户不存在" };
    }
    revalidatePath("/family-tree/settings/users");
    return { success: true, error: null };
  } catch (e) {
    console.error("resetManagedUserPassword", e);
    return { success: false, error: formatActionError(e) };
  }
}

/** 删除用户账号 */
export async function deleteManagedUser(
  targetUserId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const gate = await requireAdminOrSuperAdmin();
    if (!gate.user) {
      return { success: false, error: gate.error };
    }

    if (targetUserId === gate.user.id) {
      return { success: false, error: "不能删除自己的账号" };
    }

    const tr = await queryOne<{ role: string }>(
      `SELECT role FROM profiles WHERE id = $1`,
      [targetUserId],
    );
    if (!tr) {
      return { success: false, error: "用户不存在" };
    }
    if (tr.role === "super_admin") {
      return { success: false, error: "不能删除超级管理员账号" };
    }

    await withTransaction(async (client) => {
      await client.query(`DELETE FROM profiles WHERE id = $1`, [targetUserId]);
      await client.query(`DELETE FROM app_users WHERE id = $1`, [targetUserId]);
    });

    revalidatePath("/family-tree/settings/users");
    revalidatePath("/family-tree", "layout");
    revalidatePath("/blog", "layout");
    return { success: true, error: null };
  } catch (e) {
    console.error("deleteManagedUser", e);
    return { success: false, error: formatActionError(e) };
  }
}
