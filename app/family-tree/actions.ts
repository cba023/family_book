"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface FamilyMember {
  id: number;
  name: string;
  generation: number | null;
  sibling_order: number | null;
  father_id: number | null;
  father_name: string | null;
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
  updated_at: string;
}

export interface FetchMembersResult {
  data: FamilyMember[];
  count: number;
  error: string | null;
}

export async function fetchFamilyMembers(
  page: number = 1,
  pageSize: number = 50,
  searchQuery: string = ""
): Promise<FetchMembersResult> {
  try {
    const offset = (page - 1) * pageSize;

    // 构建查询条件
    let whereClause = "";
    const params: any[] = [];
    if (searchQuery.trim()) {
      whereClause = "WHERE name LIKE ?";
      params.push(`%${searchQuery.trim()}%`);
    }

    // 获取总数
    const countResult = db.prepare(
      `SELECT COUNT(*) as count FROM family_members ${whereClause}`
    ).get(...params) as { count: number };

    // 获取分页数据
    const data = db.prepare(`
      SELECT * FROM family_members 
      ${whereClause}
      ORDER BY generation ASC, sibling_order ASC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset) as any[];

    // 获取所有父亲 ID 和配偶 ID
    const fatherIds = data
      .map((item) => item.father_id)
      .filter((id): id is number => id !== null);
    const spouseIds = data
      .map((item) => item.spouse_id)
      .filter((id): id is number => id !== null);

    // 批量查询父亲姓名
    let fatherMap: Record<number, string> = {};
    if (fatherIds.length > 0) {
      const placeholders = fatherIds.map(() => '?').join(',');
      const fathers = db.prepare(
        `SELECT id, name FROM family_members WHERE id IN (${placeholders})`
      ).all(...fatherIds) as any[];

      fatherMap = Object.fromEntries(fathers.map((f) => [f.id, f.name]));
    }

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
    const transformedData: FamilyMember[] = data.map((item) => ({
      ...item,
      is_alive: item.is_alive === 1,
      is_married_in: item.is_married_in === 1,
      father_name: item.father_id ? fatherMap[item.father_id] || null : null,
      spouse_name: item.spouse_id ? spouseMap[item.spouse_id] || null : null,
    }));

    return { data: transformedData, count: countResult.count, error: null };
  } catch (error) {
    console.error("Error fetching family members:", error);
    return { data: [], count: 0, error: error instanceof Error ? error.message : "未知错误" };
  }
}

export interface CreateMemberInput {
  name: string;
  generation?: number | null;
  sibling_order?: number | null;
  father_id?: number | null;
  gender?: "男" | "女" | null;
  official_position?: string | null;
  is_alive?: boolean;
  spouse_id?: number | null;
  is_married_in?: boolean;
  remarks?: string | null;
  birthday?: string | null;
  death_date?: string | null;
  residence_place?: string | null;
}

export async function createFamilyMember(
  input: CreateMemberInput
): Promise<{ success: boolean; error: string | null }> {
  const transaction = db.transaction(() => {
    // 1. 插入新成员
    const result = db.prepare(`
      INSERT INTO family_members (
        name, generation, sibling_order, father_id, gender,
        official_position, is_alive, spouse_id, is_married_in, remarks, birthday,
        death_date, residence_place, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      input.name,
      input.generation ?? null,
      input.sibling_order ?? null,
      input.father_id ?? null,
      input.gender ?? null,
      input.official_position ?? null,
      input.is_alive ?? true ? 1 : 0,
      input.spouse_id ?? null,
      input.is_married_in ? 1 : 0,
      input.remarks ?? null,
      input.birthday ?? null,
      input.death_date ?? null,
      input.residence_place ?? null
    );

    const newMemberId = result.lastInsertRowid as number;

    // 2. 如果指定了配偶，双向关联
    if (input.spouse_id) {
      // 更新配偶的 spouse_id 指向新成员
      db.prepare(`
        UPDATE family_members SET spouse_id = ?, updated_at = datetime('now') WHERE id = ?
      `).run(newMemberId, input.spouse_id);
    }

    return newMemberId;
  });

  try {
    transaction();
    revalidatePath("/family-tree", "layout");
    return { success: true, error: null };
  } catch (error) {
    console.error("Error creating family member:", error);
    return { success: false, error: error instanceof Error ? error.message : "未知错误" };
  }
}

export async function deleteFamilyMembers(
  ids: number[]
): Promise<{ success: boolean; error: string | null }> {
  if (ids.length === 0) {
    return { success: false, error: "没有选择要删除的成员" };
  }

  try {
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM family_members WHERE id IN (${placeholders})`).run(...ids);

    revalidatePath("/family-tree", "layout");
    return { success: true, error: null };
  } catch (error) {
    console.error("Error deleting family members:", error);
    return { success: false, error: error instanceof Error ? error.message : "未知错误" };
  }
}

// 获取所有成员用于父亲选择下拉框
export async function fetchAllMembersForSelect(): Promise<
  { id: number; name: string; generation: number | null; gender: string | null; is_married_in: boolean; father_id: number | null; spouse_id: number | null }[]
> {
  try {
    const members = db.prepare(`
      SELECT id, name, generation, gender, is_married_in, father_id, spouse_id
      FROM family_members
      ORDER BY generation ASC, name ASC
    `).all() as any[];

    return members.map(m => ({
      ...m,
      is_married_in: m.is_married_in === 1
    }));
  } catch (error) {
    console.error("Error fetching members for select:", error);
    return [];
  }
}

export interface UpdateMemberInput extends CreateMemberInput {
  id: number;
}

// 获取时间轴所需的所有成员数据
export async function fetchMembersForTimeline(): Promise<FamilyMember[]> {
  try {
    const members = db.prepare(`
      SELECT * FROM family_members ORDER BY generation ASC, sibling_order ASC
    `).all() as any[];

    return members.map((data) => {
      // 查询父亲姓名
      let father_name: string | null = null;
      if (data.father_id) {
        const father = db.prepare(`
          SELECT name FROM family_members WHERE id = ?
        `).get(data.father_id) as any;
        father_name = father?.name || null;
      }

      return {
        ...data,
        is_alive: data.is_alive === 1,
        father_name,
      };
    });
  } catch (error) {
    console.error("Error fetching members for timeline:", error);
    return [];
  }
}

// 根据 ID 获取单个成员
export async function fetchMemberById(
  id: number
): Promise<FamilyMember | null> {
  try {
    const data = db.prepare(`
      SELECT * FROM family_members WHERE id = ?
    `).get(id) as any;

    if (!data) return null;

    // 查询父亲姓名
    let father_name: string | null = null;
    if (data.father_id) {
      const father = db.prepare(`
        SELECT name FROM family_members WHERE id = ?
      `).get(data.father_id) as any;
      father_name = father?.name || null;
    }

    return {
      ...data,
      is_alive: data.is_alive === 1,
      father_name,
    };
  } catch (error) {
    console.error("Error fetching member by id:", error);
    return null;
  }
}

export async function updateFamilyMember(
  input: UpdateMemberInput
): Promise<{ success: boolean; error: string | null }> {
  const transaction = db.transaction(() => {
    // 1. 获取当前成员的原有配偶
    const currentMember = db.prepare(`
      SELECT spouse_id FROM family_members WHERE id = ?
    `).get(input.id) as { spouse_id: number | null } | undefined;

    const oldSpouseId = currentMember?.spouse_id;
    const newSpouseId = input.spouse_id;

    // 2. 更新当前成员
    db.prepare(`
      UPDATE family_members SET
        name = ?,
        generation = ?,
        sibling_order = ?,
        father_id = ?,
        gender = ?,
        official_position = ?,
        is_alive = ?,
        spouse_id = ?,
        is_married_in = ?,
        remarks = ?,
        birthday = ?,
        death_date = ?,
        residence_place = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      input.name,
      input.generation ?? null,
      input.sibling_order ?? null,
      input.father_id ?? null,
      input.gender ?? null,
      input.official_position ?? null,
      input.is_alive ?? true ? 1 : 0,
      input.spouse_id ?? null,
      input.is_married_in ? 1 : 0,
      input.remarks ?? null,
      input.birthday ?? null,
      input.death_date ?? null,
      input.residence_place ?? null,
      input.id
    );

    // 3. 处理配偶关系的双向关联
    if (newSpouseId && newSpouseId !== oldSpouseId) {
      // 设置了新配偶，更新新配偶的 spouse_id 指向当前成员
      db.prepare(`
        UPDATE family_members SET spouse_id = ?, updated_at = datetime('now') WHERE id = ?
      `).run(input.id, newSpouseId);
    }

    if (oldSpouseId && oldSpouseId !== newSpouseId) {
      // 解除了旧配偶关系，清除旧配偶的 spouse_id
      db.prepare(`
        UPDATE family_members SET spouse_id = NULL, updated_at = datetime('now') WHERE id = ?
      `).run(oldSpouseId);
    }
  });

  try {
    transaction();
    revalidatePath("/family-tree", "layout");
    return { success: true, error: null };
  } catch (error) {
    console.error("Error updating family member:", error);
    return { success: false, error: error instanceof Error ? error.message : "未知错误" };
  }
}

export interface ImportMemberInput {
  name: string;
  generation?: number | null;
  sibling_order?: number | null;
  father_name?: string | null;
  gender?: "男" | "女" | null;
  official_position?: string | null;
  is_alive?: boolean;
  spouse?: string | null;
  remarks?: string | null;
  birthday?: string | null;
  residence_place?: string | null;
}

export async function batchCreateFamilyMembers(
  members: ImportMemberInput[]
): Promise<{ success: boolean; count: number; error: string | null }> {
  try {
    // 1. 提取所有不为空的父亲姓名
    const fatherNames = Array.from(
      new Set(
        members
          .map((m) => m.father_name?.trim())
          .filter((n): n is string => !!n)
      )
    );

    // 2. 批量查找父亲 ID
    const fatherMap: Record<string, number> = {};
    if (fatherNames.length > 0) {
      const placeholders = fatherNames.map(() => '?').join(',');
      const foundFathers = db.prepare(
        `SELECT id, name FROM family_members WHERE name IN (${placeholders})`
      ).all(...fatherNames) as any[];

      foundFathers.forEach((f) => {
        fatherMap[f.name] = f.id;
      });
    }

    // 3. 构建插入数据
    const insertStmt = db.prepare(`
      INSERT INTO family_members (
        name, generation, sibling_order, father_id, gender,
        official_position, is_alive, spouse, remarks, birthday,
        residence_place, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const insertMany = db.transaction((items: ImportMemberInput[]) => {
      for (const m of items) {
        let father_id: number | null = null;
        if (m.father_name && fatherMap[m.father_name.trim()]) {
          father_id = fatherMap[m.father_name.trim()];
        }

        insertStmt.run(
          m.name,
          m.generation ?? null,
          m.sibling_order ?? null,
          father_id,
          m.gender ?? null,
          m.official_position ?? null,
          m.is_alive ?? true ? 1 : 0,
          m.spouse ?? null,
          m.remarks ?? null,
          m.birthday ?? null,
          m.residence_place ?? null
        );
      }
    });

    insertMany(members);

    revalidatePath("/family-tree", "layout");
    return { success: true, count: members.length, error: null };
  } catch (error) {
    console.error("Error batch creating family members:", error);
    return { success: false, count: 0, error: error instanceof Error ? error.message : "未知错误" };
  }
}

// 导出数据到 JSON（用于备份）
export async function exportFamilyMembersToJson(): Promise<{
  data: any[];
  error: string | null;
}> {
  try {
    const data = db.prepare(`
      SELECT * FROM family_members ORDER BY generation, sibling_order
    `).all();

    return { data, error: null };
  } catch (error) {
    console.error("Error exporting family members:", error);
    return { data: [], error: error instanceof Error ? error.message : "未知错误" };
  }
}
