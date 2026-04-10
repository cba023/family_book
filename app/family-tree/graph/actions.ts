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
  spouse_id: number | null;
  spouse_name: string | null;
  is_married_in: boolean;
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
    // 只查询非嫁入的成员（家族男性成员和未嫁入的女性）
    const data = db.prepare(`
      SELECT id, name, generation, sibling_order, father_id, gender,
             official_position, is_alive, spouse_id, is_married_in, remarks, birthday,
             death_date, residence_place
      FROM family_members
      WHERE is_married_in = 0 OR is_married_in IS NULL
      ORDER BY generation ASC, sibling_order ASC
    `).all() as any[];

    // 获取所有配偶ID
    const spouseIds = data
      .map((item) => item.spouse_id)
      .filter((id): id is number => id !== null);

    // 批量查询配偶姓名
    let spouseMap: Record<number, string> = {};
    if (spouseIds.length > 0) {
      const placeholders = spouseIds.map(() => '?').join(',');
      const spouses = db.prepare(
        `SELECT id, name FROM family_members WHERE id IN (${placeholders})`
      ).all(...spouseIds) as any[];

      spouseMap = Object.fromEntries(spouses.map((s) => [s.id, s.name]));
    }

    // 转换数据格式
    const transformedData: FamilyMemberNode[] = data.map((item) => ({
      ...item,
      is_alive: item.is_alive === 1,
      is_married_in: item.is_married_in === 1,
      spouse_name: item.spouse_id ? spouseMap[item.spouse_id] || null : null,
    }));

    return { data: transformedData, error: null };
  } catch (error) {
    console.error("Error fetching family members for graph:", error);
    return { data: [], error: error instanceof Error ? error.message : "未知错误" };
  }
}

// 根据ID获取单个成员（包括嫁入的成员）
export async function fetchMemberById(id: number): Promise<FamilyMemberNode | null> {
  try {
    const data = db.prepare(`
      SELECT id, name, generation, sibling_order, father_id, gender,
             official_position, is_alive, spouse_id, is_married_in, remarks, birthday,
             death_date, residence_place
      FROM family_members
      WHERE id = ?
    `).get(id) as any;

    if (!data) return null;

    // 查询配偶姓名
    let spouse_name: string | null = null;
    if (data.spouse_id) {
      const spouse = db.prepare(`
        SELECT name FROM family_members WHERE id = ?
      `).get(data.spouse_id) as any;
      spouse_name = spouse?.name || null;
    }

    return {
      ...data,
      is_alive: data.is_alive === 1,
      is_married_in: data.is_married_in === 1,
      spouse_name,
    };
  } catch (error) {
    console.error("Error fetching member by id:", error);
    return null;
  }
}
