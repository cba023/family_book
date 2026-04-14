"use server";

import { requireUser, numId } from "@/lib/auth/session";
import { query, queryOne } from "@/lib/pg";
import { formatActionError } from "@/lib/format-action-error";

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
}

export async function fetchAllFamilyMembers(): Promise<FetchGraphResult> {
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT id, name, generation, sibling_order, father_id, gender,
              official_position, is_alive, spouse_ids, is_married_in,
              remarks, birthday, death_date, residence_place
       FROM family_members
       WHERE is_married_in = false
       ORDER BY generation ASC NULLS FIRST, sibling_order ASC NULLS FIRST`,
    );

    const memberIds = rows.map(r => numId(r.id));

    // 直接从 spouse_ids 数组获取配偶
    const spouseNamesMap: Record<number, string[]> = {};
    const spouseIdsMap: Record<number, number[]> = {};
    for (const r of rows) {
      const mid = numId(r.id);
      const raw = r.spouse_ids;
      const ids = Array.isArray(raw) ? raw.map(numId).filter((v) => !isNaN(v)) : [];
      spouseIdsMap[mid] = ids;
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
      spouseNamesMap[Number(mid)] = spouseIdsMap[Number(mid)]
        .map((sid) => nameById[sid])
        .filter(Boolean) as string[];
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
        is_married_in: Boolean(item.is_married_in),
        remarks: item.remarks != null ? String(item.remarks) : null,
        birthday: item.birthday != null ? String(item.birthday) : null,
        death_date: item.death_date != null ? String(item.death_date) : null,
        residence_place:
          item.residence_place != null ? String(item.residence_place) : null,
      };
    });

    return { data: transformedData, error: null };
  } catch (error) {
    console.error("Error fetching family members for graph:", error);
    return {
      data: [],
      error: formatActionError(error),
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

    // 获取配偶（直接从 spouse_ids 数组）
    const spouseNames: string[] = [];
    const spouseIds: number[] = [];
    const rawSpouseIds = item.spouse_ids;
    const ids = Array.isArray(rawSpouseIds) ? rawSpouseIds.map(numId).filter((v) => !isNaN(v)) : [];
    if (ids.length > 0) {
      const spouseRows = await query<{ name: string }>(
        `SELECT name FROM family_members WHERE id = ANY($1::bigint[])`,
        [ids],
      );
      for (const s of spouseRows) {
        spouseNames.push(String(s.name));
        spouseIds.push(numId(s));
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
        spouse_ids: spouseIds,
        spouse_names: spouseNames,
      is_married_in: Boolean(item.is_married_in),
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
