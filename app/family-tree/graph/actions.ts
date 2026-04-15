"use server";

import { requireUser, numId } from "@/lib/auth/session";
import { query, queryOne } from "@/lib/pg";
import { formatActionError } from "@/lib/format-action-error";
import { normalizedIsMarriedIn } from "@/lib/family-member-married-in";
import { dedupeSpouseIdsPreserveOrder } from "@/lib/family-member-spouse-ids";

export interface FamilyMemberNode {
  id: number;
  name: string;
  generation: number | null;
  sibling_order: number | null;
  father_id: number | null;
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
}

export interface FetchGraphResult {
  data: FamilyMemberNode[];
  error: string | null;
  totalMemberCount?: number;
  maxGeneration?: number;
}

/**
 * 分代查询族谱成员 - 用于虚拟化渲染
 * 只加载指定代数范围内的成员，大幅减少数据量
 */
export async function fetchFamilyMembersByGenerations(
  minGeneration: number | null = null,
  maxGeneration: number | null = null,
  expandIds: number[] = [] // 需要额外展开的节点ID（及其 ancestors）
): Promise<FetchGraphResult> {
  try {
    // 获取总人数
    const totalRow = await queryOne<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM family_members`,
    );
    const totalMemberCount = parseInt(totalRow?.c ?? "0", 10);

    // 获取最大代数
    const maxGenRow = await queryOne<{ max: string }>(
      `SELECT COALESCE(MAX(generation), 1)::text AS max FROM family_members WHERE generation IS NOT NULL`
    );
    const maxGenerationFromDB = parseInt(maxGenRow?.max ?? "1", 10);

    // 构建查询条件
    const conditions: string[] = [];
    const params: unknown[] = [];

    // 关键过滤：排除嫁入女性（她们不作为独立节点，只作为配偶显示）
    conditions.push(`NOT (gender = '女' AND is_married_in = true)`);

    if (minGeneration !== null) {
      conditions.push(`generation >= $${params.length + 1}`);
      params.push(minGeneration);
    }
    if (maxGeneration !== null) {
      conditions.push(`generation <= $${params.length + 1}`);
      params.push(maxGeneration);
    }

    // 如果有需要展开的节点，额外查询这些节点的所有祖先
    if (expandIds.length > 0) {
      // 递归查询所有祖先（CTE）
      const expandCondition = `
        WITH RECURSIVE ancestors AS (
          SELECT id, father_id FROM family_members WHERE id = ANY($${params.length + 1}::bigint[])
          UNION
          SELECT fm.id, fm.father_id FROM family_members fm
          JOIN ancestors a ON fm.id = a.father_id
        )
        SELECT DISTINCT id FROM ancestors
      `;
      conditions.push(`id IN (${expandCondition})`);
      params.push(expandIds);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderClause = "ORDER BY generation ASC NULLS FIRST, sibling_order ASC NULLS FIRST";

    const rows = await query<Record<string, unknown>>(
      `SELECT id, name, generation, sibling_order, father_id, gender,
              official_position, is_alive, spouse_ids, is_married_in,
              remarks, birthday, death_date, residence_place
       FROM family_members
       ${whereClause}
       ${orderClause}`,
      params,
    );

    // 处理配偶信息（同前）
    const memberIds = rows.map((r) => numId(r.id));
    const spouseNamesMap: Record<number, string[]> = {};
    const spouseIdsMap: Record<number, number[]> = {};

    for (const r of rows) {
      const mid = numId(r.id);
      spouseIdsMap[mid] = dedupeSpouseIdsPreserveOrder(r.spouse_ids);
      spouseNamesMap[mid] = [];
    }

    const allSpouseIds = Object.values(spouseIdsMap).flat();
    const uniqueSpouseIds = [...new Set(allSpouseIds)];
    const nameById: Record<number, string> = {};

    if (uniqueSpouseIds.length > 0) {
      const spouseRows = await query<{ id: bigint; name: string }>(
        `SELECT id, name FROM family_members WHERE id = ANY($1::bigint[])`,
        [uniqueSpouseIds],
      );
      for (const s of spouseRows) nameById[numId(s.id)] = String(s.name);
    }

    for (const mid of Object.keys(spouseIdsMap)) {
      const m = Number(mid);
      spouseNamesMap[m] = spouseIdsMap[m]
        .map((sid) => nameById[sid])
        .filter((n): n is string => !!n);
    }

    const transformedData: FamilyMemberNode[] = rows.map((item) => {
      const id = numId(item.id);
      return {
        id,
        name: String(item.name),
        generation: item.generation != null ? Number(item.generation) : null,
        sibling_order: item.sibling_order != null ? Number(item.sibling_order) : null,
        father_id: item.father_id != null ? numId(item.father_id) : null,
        gender: (item.gender as FamilyMemberNode["gender"]) ?? null,
        official_position: item.official_position != null ? String(item.official_position) : null,
        is_alive: Boolean(item.is_alive),
        spouse_ids: spouseIdsMap[id] ?? [],
        spouse_names: spouseNamesMap[id] ?? [],
        is_married_in: normalizedIsMarriedIn(
          (item.gender as FamilyMemberNode["gender"]) ?? null,
          Boolean(item.is_married_in),
        ),
        remarks: item.remarks != null ? String(item.remarks) : null,
        birthday: item.birthday != null ? String(item.birthday) : null,
        death_date: item.death_date != null ? String(item.death_date) : null,
        residence_place: item.residence_place != null ? String(item.residence_place) : null,
      };
    });

    return {
      data: transformedData,
      error: null,
      totalMemberCount,
      maxGeneration: maxGenerationFromDB,
    };
  } catch (error) {
    console.error("Error fetching family members by generations:", error);
    return {
      data: [],
      error: formatActionError(error),
      totalMemberCount: 0,
      maxGeneration: 1,
    };
  }
}

/**
 * 获取族谱统计信息
 */
export async function fetchGraphStats() {
  try {
    const [totalRow, maxGenRow, aliveRow] = await Promise.all([
      queryOne<{ c: string }>(`SELECT COUNT(*)::text AS c FROM family_members`),
      queryOne<{ max: string }>(`SELECT COALESCE(MAX(generation), 1)::text AS max FROM family_members WHERE generation IS NOT NULL`),
      queryOne<{ c: string }>(`SELECT COUNT(*)::text AS c FROM family_members WHERE is_alive = true`),
    ]);

    return {
      total: parseInt(totalRow?.c ?? "0", 10),
      maxGeneration: parseInt(maxGenRow?.max ?? "1", 10),
      alive: parseInt(aliveRow?.c ?? "0", 10),
    };
  } catch (error) {
    console.error("Error fetching graph stats:", error);
    return { total: 0, maxGeneration: 1, alive: 0 };
  }
}

/**
 * 根据 ID 查询单个成员信息
 */
export async function fetchMemberById(
  id: number,
): Promise<FamilyMemberNode | null> {
  const { user, error: authError } = await requireUser();
  if (!user) {
    console.error("fetchMemberById graph:", authError);
    return null;
  }

  try {
    const data = await queryOne<Record<string, unknown>>(
      `SELECT id, name, generation, sibling_order, father_id, gender,
              official_position, is_alive, spouse_ids, is_married_in,
              remarks, birthday, death_date, residence_place
       FROM family_members WHERE id = $1`,
      [id],
    );
    if (!data) return null;

    const item = data;
    const memberId = numId(item.id);

    const orderedSpouseIds = dedupeSpouseIdsPreserveOrder(item.spouse_ids);
    const spouseNames: string[] = [];
    if (orderedSpouseIds.length > 0) {
      const spouseRows = await query<{ id: bigint; name: string }>(
        `SELECT id, name FROM family_members WHERE id = ANY($1::bigint[])`,
        [orderedSpouseIds],
      );
      const nameById = Object.fromEntries(
        spouseRows.map((s) => [numId(s.id), String(s.name)]),
      );
      for (const sid of orderedSpouseIds) {
        const n = nameById[sid];
        if (n) spouseNames.push(n);
      }
    }

    return {
      id: memberId,
      name: String(item.name),
      generation: item.generation != null ? Number(item.generation) : null,
      sibling_order:
        item.sibling_order != null ? Number(item.sibling_order) : null,
      father_id: item.father_id != null ? numId(item.father_id) : null,
      gender: (item.gender as FamilyMemberNode["gender"]) ?? null,
      official_position:
        item.official_position != null ? String(item.official_position) : null,
        is_alive: Boolean(item.is_alive),
        spouse_ids: orderedSpouseIds,
        spouse_names: spouseNames,
      is_married_in: normalizedIsMarriedIn(
        (item.gender as FamilyMemberNode["gender"]) ?? null,
        Boolean(item.is_married_in),
      ),
      remarks: item.remarks != null ? String(item.remarks) : null,
      birthday: item.birthday != null ? String(item.birthday) : null,
      death_date: item.death_date != null ? String(item.death_date) : null,
      residence_place:
        item.residence_place != null ? String(item.residence_place) : null,
    };
  } catch (error) {
    console.error("Error fetching member by id:", error);
    return null;
  }
}
