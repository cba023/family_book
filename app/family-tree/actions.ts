"use server";

import { requireUser, requireAdmin, numId } from "@/lib/auth/session";
import { formatActionError } from "@/lib/format-action-error";
import { query, queryOne, getPool } from "@/lib/pg";
import { revalidatePath } from "next/cache";
import { exportToGedcom, parseGedcom } from "@/lib/gedcom";
import PDFDocument from "pdfkit";
import { FAMILY_SURNAME } from "@/lib/utils";

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
  spouse_ids: number[];
  spouse_names: string[];
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
  spouseNamesMap: Record<number, string[]>,
): FamilyMember {
  const id = numId(item.id);
  const fid = item.father_id != null ? numId(item.father_id) : null;
  const rawSpouseIds = item.spouse_ids;
  let spouseIds: number[] = [];
  if (Array.isArray(rawSpouseIds)) {
    spouseIds = rawSpouseIds.map((v) => numId(v)).filter((v) => !isNaN(v));
  }
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
    spouse_ids: spouseIds,
    spouse_names: spouseNamesMap[id] ?? [],
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

    // 获取所有成员的配偶（直接从 spouse_ids 数组，取名字）
    const memberIds = rows.map((r) => numId(r.id));
    const allSpouseIds = memberIds.flatMap((mid) => {
      const raw = rows.find((r) => numId(r.id) === mid)?.spouse_ids;
      return Array.isArray(raw) ? raw.map(numId).filter((v) => !isNaN(v)) : [];
    });
    const uniqueSpouseIds = [...new Set(allSpouseIds)];

    const spouseNamesMap: Record<number, string[]> = {};
    if (uniqueSpouseIds.length > 0) {
      const spouses = await query<{ id: bigint; name: string }>(
        `SELECT id, name FROM family_members WHERE id = ANY($1::bigint[])`,
        [uniqueSpouseIds],
      );
      const nameById: Record<number, string> = {};
      for (const s of spouses) {
        nameById[numId(s.id)] = String(s.name);
      }
      for (const mid of memberIds) {
        const raw = rows.find((r) => numId(r.id) === mid)?.spouse_ids;
        const ids = Array.isArray(raw) ? raw.map(numId).filter((v) => !isNaN(v)) : [];
        // 去重后映射名字
        spouseNamesMap[mid] = [...new Set(ids)].map((sid) => nameById[sid]).filter(Boolean) as string[];
      }
    }

    const transformedData = rows.map((item) => {
      const { __full_count: _, ...rest } = item;
      return mapMemberRow(rest, fatherMap, spouseNamesMap);
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
  spouse_ids?: number[];
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
        official_position, is_alive, spouse_ids, is_married_in, remarks,
        birthday, death_date, residence_place, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, '{}', $9, $10, $11, $12, $13, NOW()
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

    // 写入配偶数组（双向）
    const newSpouseIds = input.spouse_ids ?? [];
    const allSpouseIdsForNew = [...new Set([newMemberId, ...newSpouseIds])];
    for (const spouseId of newSpouseIds) {
      await getPool().query(
        `UPDATE family_members SET spouse_ids = array_append(COALESCE(spouse_ids,'{}'), $1::bigint), updated_at = NOW() WHERE id = $2`,
        [spouseId, newMemberId],
      );
      await getPool().query(
        `UPDATE family_members SET spouse_ids = array_append(COALESCE(spouse_ids,'{}'), $1::bigint), updated_at = NOW() WHERE id = $2`,
        [newMemberId, spouseId],
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
    spouse_ids: number[];
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
      spouse_ids: number[];
    }>(
      `SELECT id, name, generation, gender, is_married_in, father_id, spouse_ids
       FROM family_members
       ORDER BY generation ASC NULLS FIRST, name ASC`,
    );

    // 直接从 spouse_ids 数组获取配偶
    const spouseIdsMap: Record<number, number[]> = {};
    for (const m of data) {
      const mid = numId(m.id);
      const raw = m.spouse_ids;
      spouseIdsMap[mid] = Array.isArray(raw) ? raw.map(numId).filter((v) => !isNaN(v)) : [];
    }

    return data.map((m) => ({
      id: numId(m.id),
      name: String(m.name),
      generation: m.generation != null ? Number(m.generation) : null,
      gender: m.gender != null ? String(m.gender) : null,
      is_married_in: Boolean(m.is_married_in),
      father_id: m.father_id != null ? numId(m.father_id) : null,
      // 去重
      spouse_ids: [...new Set(spouseIdsMap[numId(m.id)] ?? [])],
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

    // 直接从 spouse_ids 数组获取配偶
    const spouseNamesMap: Record<number, string[]> = {};
    const spouseIdsMap: Record<number, number[]> = {};
    for (const r of rows) {
      const mid = numId(r.id);
      const raw = r.spouse_ids;
      const ids = Array.isArray(raw) ? raw.map(numId).filter((v) => !isNaN(v)) : [];
      spouseIdsMap[mid] = ids;
      spouseNamesMap[mid] = []; // 名字稍后统一查询填充
    }

    const allSpouseIds = Object.values(spouseIdsMap).flat();
    const uniqueSpouseIds = [...new Set(allSpouseIds)];
    const nameById: Record<number, string> = {};
    if (uniqueSpouseIds.length > 0) {
      const spouseRows = await query<{ id: bigint; name: string }>(
        `SELECT id, name FROM family_members WHERE id = ANY($1::bigint[])`,
        [uniqueSpouseIds],
      );
      for (const s of spouseRows) {
        nameById[numId(s.id)] = String(s.name);
      }
    }
    for (const mid of Object.keys(spouseIdsMap)) {
      spouseNamesMap[Number(mid)] = spouseIdsMap[Number(mid)]
        .map((sid) => nameById[sid])
        .filter(Boolean) as string[];
    }

    const members = rows.map((item) => {
      const fid = item.father_id != null ? numId(item.father_id) : null;
      const id = numId(item.id);
      return {
        id,
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
        spouse_ids: spouseIdsMap[id] ?? [],
        spouse_names: spouseNamesMap[id] ?? [],
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

    // 获取配偶（直接从 spouse_ids 数组）
    const memberId = numId(item.id);
    const spouseNames: string[] = [];
    const rawSpouseIds = item.spouse_ids;
    const spouseIds = Array.isArray(rawSpouseIds)
      ? rawSpouseIds.map(numId).filter((v) => !isNaN(v))
      : [];
    if (spouseIds.length > 0) {
      const spouseRows = await query<{ name: string }>(
        `SELECT name FROM family_members WHERE id = ANY($1::bigint[])`,
        [spouseIds],
      );
      for (const s of spouseRows) {
        spouseNames.push(String(s.name));
      }
    }

    const fid = item.father_id != null ? numId(item.father_id) : null;
    return {
      id: memberId,
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
      spouse_ids: spouseIds,
      spouse_names: spouseNames,
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
    const alive = input.is_alive ?? true;

    await getPool().query(
      `UPDATE family_members SET
        name = $1, generation = $2, sibling_order = $3, father_id = $4,
        gender = $5, official_position = $6, is_alive = $7, is_married_in = $8,
        remarks = $9, birthday = $10, death_date = $11,
        residence_place = $12, updated_at = NOW()
      WHERE id = $13`,
      [
        input.name,
        input.generation ?? null,
        input.sibling_order ?? null,
        input.father_id ?? null,
        input.gender ?? null,
        input.official_position ?? null,
        alive,
        // 根据 spouse_ids 是否为空来判断是否已婚
        Boolean(input.spouse_ids && input.spouse_ids.length > 0),
        input.remarks ?? null,
        input.birthday ?? null,
        input.death_date ?? null,
        input.residence_place ?? null,
        input.id,
      ],
    );

    // 写入配偶数组（双向）
    const newSpouseIds = input.spouse_ids ?? [];
    for (const spouseId of newSpouseIds) {
      await getPool().query(
        `UPDATE family_members SET spouse_ids = array_append(COALESCE(spouse_ids,'{}'), $1::bigint), updated_at = NOW() WHERE id = $2`,
        [spouseId, input.id],
      );
      await getPool().query(
        `UPDATE family_members SET spouse_ids = array_append(COALESCE(spouse_ids,'{}'), $1::bigint), updated_at = NOW() WHERE id = $2`,
        [input.id, spouseId],
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
          official_position, is_alive, spouse_ids, is_married_in, remarks,
          birthday, death_date, residence_place, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, '{}', false, $9, $10, NULL, $11, NOW()
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

      // 双向写入 spouse_ids 数组
      await getPool().query(
        `UPDATE family_members SET spouse_ids = array_append(COALESCE(spouse_ids,'{}'), $1::bigint), updated_at = NOW() WHERE id = $2`,
        [spouseId, selfId],
      );
      await getPool().query(
        `UPDATE family_members SET spouse_ids = array_append(COALESCE(spouse_ids,'{}'), $1::bigint), updated_at = NOW() WHERE id = $2`,
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

export async function exportFamilyToPDF(): Promise<{
  success: boolean;
  data?: Uint8Array;
  filename?: string;
  error?: string;
}> {
  const { user, error: authError } = await requireAdmin();
  if (!user) {
    return { success: false, error: authError || "需要管理员权限" };
  }

  try {
    const pool = getPool();
    const { rows: members } = await pool.query(
      `SELECT fm.*, f.name as father_name
       FROM family_members fm
       LEFT JOIN family_members f ON fm.father_id = f.id
       WHERE fm.user_id = $1
       ORDER BY fm.generation, fm.sibling_order`,
      [user.id]
    );

    // 获取所有成员的配偶（直接从 spouse_ids 数组）
    const spouseMap: Record<number, string[]> = {};
    const allSpouseIds: number[] = [];
    for (const m of members) {
      const mid = numId(m.id);
      const raw = (m as Record<string, unknown>).spouse_ids;
      const ids = Array.isArray(raw) ? raw.map(numId).filter((v) => !isNaN(v)) : [];
      spouseMap[mid] = [];
      if (ids.length > 0) {
        allSpouseIds.push(...ids);
      }
    }
    if (allSpouseIds.length > 0) {
      const spouseRows = await query<{ id: bigint; name: string }>(
        `SELECT id, name FROM family_members WHERE id = ANY($1::bigint[])`,
        [[...new Set(allSpouseIds)]],
      );
      const nameById: Record<number, string> = {};
      for (const s of spouseRows) nameById[numId(s.id)] = String(s.name);
      for (const m of members) {
        const mid = numId(m.id);
        const raw = (m as Record<string, unknown>).spouse_ids;
        const ids = Array.isArray(raw) ? raw.map(numId).filter((v) => !isNaN(v)) : [];
        spouseMap[mid] = ids.map((sid) => nameById[sid]).filter(Boolean) as string[];
      }
    }

    if (members.length === 0) {
      return { success: false, error: "没有可导出的成员数据" };
    }

    // 使用系统字体或内置字体
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `${FAMILY_SURNAME}氏族谱`,
        Author: "Family Book",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    // 封面
    doc
      .fillColor("#8B4513")
      .fontSize(36)
      .font("Helvetica-Bold")
      .text(`${FAMILY_SURNAME}氏族谱`, 0, 200, { align: "center" })
      .moveDown();

    doc
      .fillColor("#666")
      .fontSize(14)
      .font("Helvetica")
      .text(`共收录 ${members.length} 位族人`, { align: "center" })
      .moveDown(2);

    doc
      .fillColor("#999")
      .fontSize(12)
      .text(`导出时间：${new Date().toLocaleDateString("zh-CN")}`, { align: "center" })
      .moveDown(4);

    // 目录页
    doc.addPage();
    doc
      .fillColor("#333")
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("目  录", 50, 50)
      .moveDown();

    doc
      .fontSize(12)
      .font("Helvetica")
      .fillColor("#333");

    let yPos = 100;
    members.forEach((member, index) => {
      doc.text(
        `${index + 1}. ${member.name}  (第${member.generation || "?"}世  ${member.gender || ""})`,
        50,
        yPos
      );
      yPos += 22;
      if (yPos > 750) {
        doc.addPage();
        yPos = 50;
      }
    });

    // 成员详情页
    members.forEach((member) => {
      doc.addPage();

      doc
        .fillColor("#8B4513")
        .fontSize(20)
        .font("Helvetica-Bold")
        .text(member.name, 50, 50);

      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#666");

      const deathInfo = member.is_alive ? "" : ` - ${member.death_date || "不详"}`;
      const info = [
        `世    代：第 ${member.generation || "?"} 世`,
        `排    行：第 ${member.sibling_order || "?"} 位`,
        `性    别：${member.gender || "不详"}`,
        `生    卒：${member.birthday || "不详"}${deathInfo}`,
        `居住地：${member.residence_place || "不详"}`,
        `职    业：${member.official_position || "不详"}`,
        `父    亲：${member.father_name || "不详"}`,
        `配    偶：${(spouseMap[member.id] || []).join("、") || "不详"}`,
      ];

      let infoY = 90;
      info.forEach((line) => {
        doc.text(line, 50, infoY);
        infoY += 18;
      });

      if (member.remarks) {
        doc
          .fillColor("#333")
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("生平事迹", 50, infoY + 20);

        doc
          .fontSize(10)
          .font("Helvetica")
          .fillColor("#555")
          .text(member.remarks, 50, infoY + 45, {
            width: 495,
            align: "justify",
          });
      }

      doc
        .fillColor("#999")
        .fontSize(8)
        .text(
          `${FAMILY_SURNAME}氏族谱 - ${member.name}`,
          50,
          780,
          { align: "center" }
        );
    });

    doc.end();

    await new Promise<void>((resolve, reject) => {
      doc.on("end", () => resolve());
      doc.on("error", reject);
    });

    const pdfBuffer = Buffer.concat(chunks);
    const filename = `${FAMILY_SURNAME}氏族谱_${new Date().toISOString().split("T")[0]}.pdf`;

    return {
      success: true,
      data: new Uint8Array(pdfBuffer),
      filename,
    };
  } catch (error) {
    console.error("PDF导出失败:", error);
    return { success: false, error: "导出失败，请重试" };
  }
}

export async function exportFamilyMembersToJson(): Promise<{
  data: FamilyMember[];
  error: string | null;
}> {
  const { user, error: authError } = await requireUser();
  if (!user) {
    return { data: [], error: authError };
  }

  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT fm.*, f.name as father_name
       FROM family_members fm
       LEFT JOIN family_members f ON fm.father_id = f.id
       ORDER BY fm.generation ASC NULLS FIRST, fm.sibling_order ASC NULLS FIRST`,
    );

    const fatherMap: Record<number, string> = {};
    const spouseNamesMap: Record<number, string[]> = {};

    rows.forEach((item) => {
      const id = numId(item.id);
      if (item.father_name) {
        fatherMap[id] = String(item.father_name);
      }
    });

    // 从 spouse_ids 数组提取配偶名字
    const allSpouseIds: number[] = [];
    const memberSpouseIdsMap: Record<number, number[]> = {};
    for (const r of rows) {
      const mid = numId(r.id);
      const raw = r.spouse_ids;
      if (Array.isArray(raw)) {
        const ids = raw.map(numId).filter((v) => !isNaN(v));
        memberSpouseIdsMap[mid] = ids;
        allSpouseIds.push(...ids);
      }
    }
    if (allSpouseIds.length > 0) {
      const spouseRows = await query<{ id: bigint; name: string }>(
        `SELECT id, name FROM family_members WHERE id = ANY($1::bigint[])`,
        [[...new Set(allSpouseIds)]],
      );
      const nameById: Record<number, string> = {};
      for (const s of spouseRows) {
        nameById[numId(s.id)] = String(s.name);
      }
      // 为每个成员构建其配偶名字列表
      for (const mid of Object.keys(memberSpouseIdsMap)) {
        spouseNamesMap[Number(mid)] = memberSpouseIdsMap[Number(mid)]
          .map((sid) => nameById[sid])
          .filter(Boolean) as string[];
      }
    }

    const data = rows.map((item) => mapMemberRow(item, fatherMap, spouseNamesMap));
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
          official_position, is_alive, spouse_ids, is_married_in,
          remarks, birthday, death_date, residence_place
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}', $9, $10, $11, $12, $13)
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
        // 解析配偶 ID 列表（从 GEDCOM 导入的临时 ID 映射到实际数据库 ID）
        const spouseIds = (member.spouse_ids ?? [])
          .map(sid => memberIdMap.get(sid))
          .filter((id): id is number => id !== undefined);

        // 更新 father_id 和 spouse_ids 数组
        await pool.query(
          `UPDATE family_members SET father_id = $1 WHERE id = $2`,
          [actualFatherId, actualId]
        );

        // 写入配偶数组（双向）
        for (const spouseId of spouseIds) {
          await pool.query(
            `UPDATE family_members SET spouse_ids = array_append(COALESCE(spouse_ids,'{}'), $1::bigint) WHERE id = $2`,
            [spouseId, actualId]
          );
          await pool.query(
            `UPDATE family_members SET spouse_ids = array_append(COALESCE(spouse_ids,'{}'), $1::bigint) WHERE id = $2`,
            [actualId, spouseId]
          );
        }
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
