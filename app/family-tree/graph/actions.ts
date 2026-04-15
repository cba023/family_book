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
  /** 成员表总人数（含嫁入），用于空状态提示 */
  totalMemberCount?: number;
}

export async function fetchAllFamilyMembers(): Promise<FetchGraphResult> {
  try {
    const totalRow = await queryOne<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM family_members`,
    );
    const totalMemberCount = parseInt(totalRow?.c ?? "0", 10);

    const rows = await query<Record<string, unknown>>(
      `SELECT id, name, generation, sibling_order, father_id, gender,
              official_position, is_alive, spouse_ids, is_married_in,
              remarks, birthday, death_date, residence_place
       FROM family_members
       WHERE NOT (gender = '女' AND is_married_in = true)
       ORDER BY generation ASC NULLS FIRST, sibling_order ASC NULLS FIRST`,
    );

    const memberIds = rows.map(r => numId(r.id));

    // 直接从 spouse_ids 数组获取配偶
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
        sibling_order:
          item.sibling_order != null ? Number(item.sibling_order) : null,
        father_id: item.father_id != null ? numId(item.father_id) : null,
        gender: (item.gender as FamilyMemberNode["gender"]) ?? null,
        official_position:
          item.official_position != null ? String(item.official_position) : null,
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
        residence_place:
          item.residence_place != null ? String(item.residence_place) : null,
      };
    });

    return { data: transformedData, error: null, totalMemberCount };
  } catch (error) {
    console.error("Error fetching family members for graph:", error);
    return {
      data: [],
      error: formatActionError(error),
      totalMemberCount: 0,
    };
  }
}

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
