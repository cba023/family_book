"use server";

import { db } from "@/lib/db";

export interface FamilyMemberNode {
  id: number;
  name: string;
  generation: number | null;
  sibling_order: number | null;
  father_id: number | null;
  gender: "男" | "女" | null;
  official_position: string | null;
  is_alive: boolean;
  spouse: string | null;
  remarks: string | null;
  birthday: string | null;
  death_date: string | null;
  residence_place: string | null;
}

export interface FetchGraphResult {
  data: FamilyMemberNode[];
  error: string | null;
}

export async function fetchAllFamilyMembers(): Promise<FetchGraphResult> {
  try {
    const data = db.prepare(`
      SELECT id, name, generation, sibling_order, father_id, gender, 
             official_position, is_alive, spouse, remarks, birthday, 
             death_date, residence_place
      FROM family_members
      ORDER BY generation ASC, sibling_order ASC
    `).all() as any[];

    // 转换布尔值
    const transformedData: FamilyMemberNode[] = data.map((item) => ({
      ...item,
      is_alive: item.is_alive === 1,
    }));

    return { data: transformedData, error: null };
  } catch (error) {
    console.error("Error fetching family members for graph:", error);
    return { data: [], error: error instanceof Error ? error.message : "未知错误" };
  }
}
