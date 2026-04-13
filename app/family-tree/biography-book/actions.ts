"use server";

import { requireUser, numId } from "@/lib/auth/session";
import { query } from "@/lib/pg";
import { formatActionError } from "@/lib/format-action-error";

export interface BiographyMember {
  id: number;
  name: string;
  generation: number | null;
  sibling_order: number | null;
  gender: "男" | "女" | null;
  birthday: string | null;
  death_date: string | null;
  is_alive: boolean;
  spouse: string | null;
  official_position: string | null;
  residence_place: string | null;
  remarks: string;
  father_name: string | null;
}

export async function fetchMembersWithBiography(): Promise<{
  data: BiographyMember[];
  error: string | null;
  requireAuth: boolean;
}> {
  try {
    const raw = await query<Record<string, unknown>>(
      `SELECT * FROM family_members
       WHERE remarks IS NOT NULL AND trim(remarks) <> ''
       ORDER BY generation ASC NULLS FIRST, sibling_order ASC NULLS FIRST`,
    );

    const validData = raw.filter((item) => {
      const remarks = item.remarks;
      if (remarks == null || String(remarks) === "") return false;
      try {
        const parsed = JSON.parse(String(remarks));
        if (Array.isArray(parsed)) {
          return parsed.some((node: { children?: { text?: string }[] }) => {
            if (node.children && Array.isArray(node.children)) {
              return node.children.some(
                (child: { text?: string }) =>
                  child.text && child.text.trim().length > 0,
              );
            }
            return false;
          });
        }
        return false;
      } catch {
        return String(remarks).trim().length > 0;
      }
    });

    const fatherIds = validData
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

    const spouseIds = validData
      .map((item) => item.spouse_id)
      .filter((id): id is number | string => id != null)
      .map(numId);

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

    const transformedData: BiographyMember[] = validData.map((item) => {
      const sid = item.spouse_id != null ? numId(item.spouse_id) : null;
      const fid = item.father_id != null ? numId(item.father_id) : null;
      return {
        id: numId(item.id),
        name: String(item.name),
        generation: item.generation != null ? Number(item.generation) : null,
        sibling_order:
          item.sibling_order != null ? Number(item.sibling_order) : null,
        gender: (item.gender as BiographyMember["gender"]) ?? null,
        birthday: item.birthday != null ? String(item.birthday) : null,
        death_date: item.death_date != null ? String(item.death_date) : null,
        is_alive: Boolean(item.is_alive),
        spouse: sid ? spouseMap[sid] ?? null : null,
        official_position:
          item.official_position != null ? String(item.official_position) : null,
        residence_place:
          item.residence_place != null ? String(item.residence_place) : null,
        remarks: String(item.remarks ?? ""),
        father_name: fid ? fatherMap[fid] ?? null : null,
      };
    });

    const { user } = await requireUser();

    return { data: transformedData, error: null, requireAuth: !user };
  } catch (error) {
    console.error("Error fetching members with biography:", error);
    return {
      data: [],
      error: formatActionError(error),
      requireAuth: false,
    };
  }
}
