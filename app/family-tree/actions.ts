"use server";

import { requireUser, requireAdmin, numId } from "@/lib/auth/session";
import { formatActionError } from "@/lib/format-action-error";
import { query, queryOne, getPool } from "@/lib/pg";
import { revalidatePath } from "next/cache";
import { exportToGedcom, parseGedcom } from "@/lib/gedcom";

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

function mapMemberRow(
  item: Record<string, unknown>,
  fatherMap: Record<number, string>,
  spouseMap: Record<number, string>,
): FamilyMember {
  const id = numId(item.id);
  const fid = item.father_id != null ? numId(item.father_id) : null;
  const sid = item.spouse_id != null ? numId(item.spouse_id) : null;
  return {
    id,
    name: String(item.name),
    generation: item.generation != null ? Number(item.generation) : null,
    sibling_order: item.sibling_order != null ? Number(item.sibling_order) : null,
    father_id: fid,
    father_name: fid ? fatherMap[fid] ?? null : null,
    gender: (item.gender as FamilyMember["gender"]) ?? null,
    official_position:
      item.official_position != null ? String(item.official_position) : null,
    is_alive: Boolean(item.is_alive),
    spouse_id: sid,
    spouse_name: sid ? spouseMap[sid] ?? null : null,
    is_married_in: Boolean(item.is_married_in),
    remarks: item.remarks != null ? String(item.remarks) : null,
    birthday: item.birthday != null ? String(item.birthday) : null,
    death_date: item.death_date != null ? String(item.death_date) : null,
    residence_place:
      item.residence_place != null ? String(item.residence_place) : null,
    updated_at:
      item.updated_at != null ? String(item.updated_at) : new Date().toISOString(),
  };
}

export async function fetchFamilyMembers(
  page: number = 1,
  pageSize: number = 50,
  searchQuery: string = "",
): Promise<FetchMembersResult> {
  const { user, error: authError } = await requireUser();
  if (!user) {
    return { data: [], count: 0, error: authError };
  }

  try {
    const offset = (page - 1) * pageSize;
    const term = searchQuery.trim();

    type Row = Record<string, unknown> & { __full_count?: string };
    const rows = await query<Row>(
      `SELECT fm.*, COUNT(*) OVER()::text AS __full_count
       FROM family_members fm
       WHERE ($1::text = '' OR fm.name ILIKE '%' || $1 || '%')
       ORDER BY fm.generation ASC NULLS FIRST,
                fm.sibling_order ASC NULLS FIRST
       LIMIT $2 OFFSET $3`,
      [term, pageSize, offset],
    );

    const count =
      rows.length > 0 ? parseInt(String(rows[0].__full_count ?? "0"), 10) : 0;

    const fatherIds = rows
      .map((item) => item.father_id)
      .filter((id): id is number | string => id != null)
      .map(numId);
    const spouseIds = rows
      .map((item) => item.spouse_id)
      .filter((id): id is number | string => id != null)
      .map(numId);

    let fatherMap: Record<number, string> = {};
    if (fatherIds.length > 0) {
      const fathers = await query<{ id: number; name: string }>(
        `SELECT id, name FROM family_members WHERE id = ANY($1::bigint[])`,
        [fatherIds],
      );
      fatherMap = Object.fromEntries(
        fathers.map((f) => [numId(f.id), String(f.name)]),
      );
    }

    let spouseMap: Record<number, string> = {};
    if (spouseIds.length > 0) {
      const spouses = await query<{ id: number; name: string }>(
        `SELECT id, name FROM family_members WHERE id = ANY($1::bigint[])`,
        [spouseIds],
      );
      spouseMap = Object.fromEntries(
        spouses.map((s) => [numId(s.id), String(s.name)]),
      );
    }

    const transformedData = rows.map((item) => {
      const { __full_count: _, ...rest } = item;
      return mapMemberRow(rest, fatherMap, spouseMap);
    });

    return {
      data: transformedData,
      count,
      error: null,
    };
  } catch (error) {
    console.error("Error fetching family members:", error);
    return {
      data: [],
      count: 0,
      error: formatActionError(error),
    };
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
  input: CreateMemberInput,
): Promise<{ success: boolean; error: string | null }> {
  const { user, error: authError } = await requireAdmin();
  if (!user) {
    return { success: false, error: authError };
  }

  try {
    const alive = input.is_alive ?? true;
    const row = await queryOne<{ id: number }>(
      `INSERT INTO family_members (
        user_id, name, generation, sibling_order, father_id, gender,
        official_position, is_alive, spouse_id, is_married_in, remarks,
        birthday, death_date, residence_place, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
      ) RETURNING id`,
      [
        user.id,
        input.name,
        input.generation ?? null,
        input.sibling_order ?? null,
        input.father_id ?? null,
        input.gender ?? null,
        input.official_position ?? null,
        alive,
        input.spouse_id ?? null,
        Boolean(input.is_married_in),
        input.remarks ?? null,
        input.birthday ?? null,
        input.death_date ?? null,
        input.residence_place ?? null,
      ],
    );

    if (!row) {
      return { success: false, error: "插入失败" };
    }
    const newMemberId = numId(row.id);

    if (input.spouse_id) {
      await getPool().query(
        `UPDATE family_members SET spouse_id = $1, updated_at = NOW() WHERE id = $2`,
        [newMemberId, input.spouse_id],
      );
    }

    revalidatePath("/family-tree", "layout");
    return { success: true, error: null };
  } catch (error) {
    console.error("Error creating family member:", error);
    return {
      success: false,
      error: formatActionError(error),
    };
  }
}

export async function deleteFamilyMembers(
  ids: number[],
): Promise<{ success: boolean; error: string | null }> {
  const { user, error: authError } = await requireAdmin();
  if (!user) {
    return { success: false, error: authError };
  }

  if (ids.length === 0) {
    return { success: false, error: "没有选择要删除的成员" };
  }

  try {
    await getPool().query(`DELETE FROM family_members WHERE id = ANY($1::bigint[])`, [
      ids,
    ]);

    revalidatePath("/family-tree", "layout");
    return { success: true, error: null };
  } catch (error) {
    console.error("Error deleting family members:", error);
    return {
      success: false,
      error: formatActionError(error),
    };
  }
}

export async function fetchAllMembersForSelect(): Promise<
  {
    id: number;
    name: string;
    generation: number | null;
    gender: string | null;
    is_married_in: boolean;
    father_id: number | null;
    spouse_id: number | null;
  }[]
> {
  const { user, error: authError } = await requireAdmin();
  if (!user) {
    console.error("fetchAllMembersForSelect:", authError);
    return [];
  }

  try {
    const data = await query<{
      id: number;
      name: string;
      generation: number | null;
      gender: string | null;
      is_married_in: boolean;
      father_id: number | null;
      spouse_id: number | null;
    }>(
      `SELECT id, name, generation, gender, is_married_in, father_id, spouse_id
       FROM family_members
       ORDER BY generation ASC NULLS FIRST, name ASC`,
    );

    return data.map((m) => ({
      id: numId(m.id),
      name: String(m.name),
      generation: m.generation != null ? Number(m.generation) : null,
      gender: m.gender != null ? String(m.gender) : null,
      is_married_in: Boolean(m.is_married_in),
      father_id: m.father_id != null ? numId(m.father_id) : null,
      spouse_id: m.spouse_id != null ? numId(m.spouse_id) : null,
    }));
  } catch (error) {
    console.error("Error fetching members for select:", error);
    return [];
  }
}

export interface UpdateMemberInput extends CreateMemberInput {
  id: number;
}

export async function fetchMembersForTimeline(): Promise<{
  data: FamilyMember[];
  requireAuth: boolean;
}> {
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM family_members
       ORDER BY generation ASC NULLS FIRST, sibling_order ASC NULLS FIRST`,
    );

    const fatherIds = rows
      .map((r) => r.father_id)
      .filter((id): id is number | string => id != null)
      .map(numId);

    let fatherMap: Record<number, string> = {};
    if (fatherIds.length > 0) {
      const fathers = await query<{ id: number; name: string }>(
        `SELECT id, name FROM family_members WHERE id = ANY($1::bigint[])`,
        [fatherIds],
      );
      fatherMap = Object.fromEntries(
        fathers.map((f) => [numId(f.id), String(f.name)]),
      );
    }

    const members = rows.map((item) => {
      const fid = item.father_id != null ? numId(item.father_id) : null;
      return {
        id: numId(item.id),
        name: String(item.name),
        generation: item.generation != null ? Number(item.generation) : null,
        sibling_order:
          item.sibling_order != null ? Number(item.sibling_order) : null,
        father_id: fid,
        father_name: fid ? fatherMap[fid] ?? null : null,
        gender: (item.gender as FamilyMember["gender"]) ?? null,
        official_position:
          item.official_position != null ? String(item.official_position) : null,
        is_alive: Boolean(item.is_alive),
        spouse_id: item.spouse_id != null ? numId(item.spouse_id) : null,
        spouse_name: null,
        is_married_in: Boolean(item.is_married_in),
        remarks: item.remarks != null ? String(item.remarks) : null,
        birthday: item.birthday != null ? String(item.birthday) : null,
        death_date: item.death_date != null ? String(item.death_date) : null,
        residence_place:
          item.residence_place != null ? String(item.residence_place) : null,
        updated_at:
          item.updated_at != null
            ? String(item.updated_at)
            : new Date().toISOString(),
      };
    });

    const { user } = await requireUser();

    return { data: members, requireAuth: !user };
  } catch (error) {
    console.error("Error fetching members for timeline:", error);
    return { data: [], requireAuth: false };
  }
}

export async function fetchMemberById(id: number): Promise<FamilyMember | null> {
  const { user, error: authError } = await requireUser();
  if (!user) {
    console.error("fetchMemberById:", authError);
    return null;
  }

  try {
    const item = await queryOne<Record<string, unknown>>(
      `SELECT * FROM family_members WHERE id = $1`,
      [id],
    );
    if (!item) return null;

    let father_name: string | null = null;
    if (item.father_id != null) {
      const father = await queryOne<{ name: string }>(
        `SELECT name FROM family_members WHERE id = $1`,
        [numId(item.father_id)],
      );
      father_name = father?.name != null ? String(father.name) : null;
    }

    const fid = item.father_id != null ? numId(item.father_id) : null;
    return {
      id: numId(item.id),
      name: String(item.name),
      generation: item.generation != null ? Number(item.generation) : null,
      sibling_order:
        item.sibling_order != null ? Number(item.sibling_order) : null,
      father_id: fid,
      father_name,
      gender: (item.gender as FamilyMember["gender"]) ?? null,
      official_position:
        item.official_position != null ? String(item.official_position) : null,
      is_alive: Boolean(item.is_alive),
      spouse_id: item.spouse_id != null ? numId(item.spouse_id) : null,
      spouse_name: null,
      is_married_in: Boolean(item.is_married_in),
      remarks: item.remarks != null ? String(item.remarks) : null,
      birthday: item.birthday != null ? String(item.birthday) : null,
      death_date: item.death_date != null ? String(item.death_date) : null,
      residence_place:
        item.residence_place != null ? String(item.residence_place) : null,
      updated_at:
        item.updated_at != null
          ? String(item.updated_at)
          : new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error fetching member by id:", error);
    return null;
  }
}

export async function updateFamilyMember(
  input: UpdateMemberInput,
): Promise<{ success: boolean; error: string | null }> {
  const { user, error: authError } = await requireAdmin();
  if (!user) {
    return { success: false, error: authError };
  }

  try {
    const currentMember = await queryOne<{ spouse_id: number | null }>(
      `SELECT spouse_id FROM family_members WHERE id = $1`,
      [input.id],
    );
    if (!currentMember) {
      return { success: false, error: "成员不存在" };
    }

    const oldSpouseId =
      currentMember.spouse_id != null
        ? numId(currentMember.spouse_id)
        : null;
    const newSpouseId = input.spouse_id ?? null;
    const alive = input.is_alive ?? true;

    await getPool().query(
      `UPDATE family_members SET
        name = $1, generation = $2, sibling_order = $3, father_id = $4,
        gender = $5, official_position = $6, is_alive = $7, spouse_id = $8,
        is_married_in = $9, remarks = $10, birthday = $11, death_date = $12,
        residence_place = $13, updated_at = NOW()
      WHERE id = $14`,
      [
        input.name,
        input.generation ?? null,
        input.sibling_order ?? null,
        input.father_id ?? null,
        input.gender ?? null,
        input.official_position ?? null,
        alive,
        newSpouseId,
        Boolean(input.is_married_in),
        input.remarks ?? null,
        input.birthday ?? null,
        input.death_date ?? null,
        input.residence_place ?? null,
        input.id,
      ],
    );

    if (newSpouseId && newSpouseId !== oldSpouseId) {
      await getPool().query(
        `UPDATE family_members SET spouse_id = $1, updated_at = NOW() WHERE id = $2`,
        [input.id, newSpouseId],
      );
    }

    if (oldSpouseId && oldSpouseId !== newSpouseId) {
      await getPool().query(
        `UPDATE family_members SET spouse_id = NULL, updated_at = NOW() WHERE id = $1`,
        [oldSpouseId],
      );
    }

    revalidatePath("/family-tree", "layout");
    return { success: true, error: null };
  } catch (error) {
    console.error("Error updating family member:", error);
    return {
      success: false,
      error: formatActionError(error),
    };
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
  members: ImportMemberInput[],
): Promise<{ success: boolean; count: number; error: string | null }> {
  const { user, error: authError } = await requireAdmin();
  if (!user) {
    return { success: false, count: 0, error: authError };
  }

  try {
    const fatherNames = Array.from(
      new Set(
        members
          .map((m) => m.father_name?.trim())
          .filter((n): n is string => !!n),
      ),
    );

    const fatherMap: Record<string, number> = {};
    if (fatherNames.length > 0) {
      const foundFathers = await query<{ id: number; name: string }>(
        `SELECT id, name FROM family_members WHERE name = ANY($1::text[])`,
        [fatherNames],
      );
      for (const f of foundFathers) {
        fatherMap[String(f.name)] = numId(f.id);
      }
    }

    const nameToLastId: Record<string, number> = {};

    for (const m of members) {
      let father_id: number | null = null;
      const fn = m.father_name?.trim();
      if (fn) {
        father_id = fatherMap[fn] ?? nameToLastId[fn] ?? null;
      }

      const alive = m.is_alive ?? true;

      const inserted = await queryOne<{ id: number }>(
        `INSERT INTO family_members (
          user_id, name, generation, sibling_order, father_id, gender,
          official_position, is_alive, spouse_id, is_married_in, remarks,
          birthday, death_date, residence_place, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NULL, false, $9, $10, NULL, $11, NOW()
        ) RETURNING id`,
        [
          user.id,
          m.name,
          m.generation ?? null,
          m.sibling_order ?? null,
          father_id,
          m.gender ?? null,
          m.official_position ?? null,
          alive,
          m.remarks ?? null,
          m.birthday ?? null,
          m.residence_place ?? null,
        ],
      );

      if (!inserted) throw new Error("批量插入失败");
      const newId = numId(inserted.id);
      nameToLastId[m.name.trim()] = newId;
    }

    for (const m of members) {
      const spouseName = m.spouse?.trim();
      if (!spouseName) continue;

      const selfId = nameToLastId[m.name.trim()];
      if (!selfId) continue;

      let spouseId: number | undefined = nameToLastId[spouseName];
      if (!spouseId) {
        const row = await queryOne<{ id: number }>(
          `SELECT id FROM family_members WHERE name = $1 LIMIT 1`,
          [spouseName],
        );
        spouseId = row ? numId(row.id) : undefined;
      }
      if (spouseId === undefined) continue;

      await getPool().query(
        `UPDATE family_members SET spouse_id = $1, updated_at = NOW() WHERE id = $2`,
        [spouseId, selfId],
      );
      await getPool().query(
        `UPDATE family_members SET spouse_id = $1, updated_at = NOW() WHERE id = $2`,
        [selfId, spouseId],
      );
    }

    revalidatePath("/family-tree", "layout");
    return { success: true, count: members.length, error: null };
  } catch (error) {
    console.error("Error batch creating family members:", error);
    return {
      success: false,
      count: 0,
      error: formatActionError(error),
    };
  }
}

export async function exportFamilyMembersToJson(): Promise<{
  data: Record<string, unknown>[];
  error: string | null;
}> {
  const { user, error: authError } = await requireAdmin();
  if (!user) {
    return { data: [], error: authError };
  }

  try {
    const data = await query<Record<string, unknown>>(
      `SELECT * FROM family_members
       ORDER BY generation ASC NULLS FIRST, sibling_order ASC NULLS FIRST`,
    );
    return { data, error: null };
  } catch (error) {
    console.error("Error exporting family members:", error);
    return {
      data: [],
      error: formatActionError(error),
    };
  }
}

export async function exportFamilyMembersToGedcom(familyName: string): Promise<{
  content: string;
  error: string | null;
}> {
  const { user, error: authError } = await requireAdmin();
  if (!user) {
    return { content: "", error: authError };
  }

  try {
    const { data, error } = await fetchFamilyMembers(1, 10000, "");
    if (error) {
      return { content: "", error };
    }

    const gedcomContent = exportToGedcom(data, { familyName });
    return { content: gedcomContent, error: null };
  } catch (error) {
    console.error("Error exporting to GEDCOM:", error);
    return {
      content: "",
      error: formatActionError(error),
    };
  }
}

export async function importFamilyMembersFromGedcom(gedcomContent: string): Promise<{
  success: boolean;
  count: number;
  error: string | null;
}> {
  const { user, error: authError } = await requireAdmin();
  if (!user) {
    return { success: false, count: 0, error: authError };
  }

  try {
    const members = parseGedcom(gedcomContent);
    
    // 批量导入成员
    const pool = getPool();
    await pool.query("BEGIN");
    
    // 第一步：导入所有成员，不包含关系
    const memberIdMap = new Map<number, number>(); // 临时 ID -> 实际数据库 ID
    for (const member of members) {
      const { rows } = await pool.query(
        `INSERT INTO family_members (
          user_id, name, generation, sibling_order, father_id, gender, 
          official_position, is_alive, spouse_id, is_married_in, 
          remarks, birthday, death_date, residence_place
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id`,
        [
          user.id, // 当前用户的 ID
          member.name,
          member.generation,
          member.sibling_order,
          null, // 先设为 null，稍后更新
          member.gender,
          member.official_position,
          member.is_alive,
          null, // 先设为 null，稍后更新
          member.is_married_in,
          member.remarks,
          member.birthday,
          member.death_date,
          member.residence_place
        ]
      );
      if (rows.length > 0) {
        memberIdMap.set(member.id, rows[0].id);
      }
    }
    
    // 第二步：更新关系
    for (const member of members) {
      const actualId = memberIdMap.get(member.id);
      if (actualId) {
        const actualFatherId = member.father_id ? memberIdMap.get(member.father_id) : null;
        const actualSpouseId = member.spouse_id ? memberIdMap.get(member.spouse_id) : null;
        
        await pool.query(
          `UPDATE family_members 
           SET father_id = $1, spouse_id = $2 
           WHERE id = $3`,
          [actualFatherId, actualSpouseId, actualId]
        );
      }
    }
    
    const count = members.length;
    
    await pool.query("COMMIT");
    revalidatePath("/family-tree", "layout");
    return { success: true, count, error: null };
  } catch (error) {
    console.error("Error importing from GEDCOM:", error);
    return {
      success: false,
      count: 0,
      error: formatActionError(error),
    };
  }
}
