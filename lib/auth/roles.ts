export type AppRole = "super_admin" | "admin" | "user";

export function parseAppRole(raw: unknown): AppRole {
  if (raw === "super_admin") return "super_admin";
  if (raw === "admin") return "admin";
  return "user";
}

/** 可进行族谱数据维护（成员列表、导入导出等） */
export function canMaintainGenealogy(role: AppRole | null): boolean {
  return role === "super_admin" || role === "admin";
}

export function roleDisplayLabel(role: AppRole | null): string {
  if (role === "super_admin") return "超级管理员";
  if (role === "admin") return "管理员";
  return "普通用户";
}
