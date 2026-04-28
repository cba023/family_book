"use server";

import { getPool } from "@/lib/pg";
import { formatActionError } from "@/lib/format-action-error";

export interface DescendantNode {
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

export interface FetchDescendantsResult {
  ancestor: DescendantNode | null;
  data: DescendantNode[];
  error: string | null;
  descendantCount: number;
}

/**
 * 获取指定成员的所有后代（递归查询）
 */
export async function fetchDescendants(
  ancestorId: number
): Promise<FetchDescendantsResult> {
  const pool = getPool();

  try {
    // 先获取祖先节点信息
    const ancestorResult = await pool.query(
      `SELECT id, name, generation, sibling_order, father_id, gender,
              official_position, is_alive, spouse_ids, is_married_in,
              remarks, birthday, death_date, residence_place
       FROM family_members WHERE id = $1`,
      [ancestorId]
    );

    if (ancestorResult.rows.length === 0) {
      return { ancestor: null, data: [], error: "成员不存在", descendantCount: 0 };
    }

    const ancestorRow = ancestorResult.rows[0];

    // 递归查询所有后代
    const descendantsResult = await pool.query(
      `WITH RECURSIVE descendants AS (
        -- 基准：祖先的直接子女（非嫁入女性）
        SELECT fm.id, fm.name, fm.generation, fm.sibling_order, fm.father_id,
               fm.gender, fm.official_position, fm.is_alive, fm.spouse_ids,
               fm.is_married_in, fm.remarks, fm.birthday, fm.death_date,
               fm.residence_place, 1 as level
        FROM family_members fm
        WHERE fm.father_id = $1
          AND NOT (fm.gender = '女' AND fm.is_married_in = true)
        UNION ALL
        -- 递归：子女的子女
        SELECT fm.id, fm.name, fm.generation, fm.sibling_order, fm.father_id,
               fm.gender, fm.official_position, fm.is_alive, fm.spouse_ids,
               fm.is_married_in, fm.remarks, fm.birthday, fm.death_date,
               fm.residence_place, d.level + 1
        FROM family_members fm
        INNER JOIN descendants d ON fm.father_id = d.id
        WHERE NOT (fm.gender = '女' AND fm.is_married_in = true)
      )
      SELECT * FROM descendants ORDER BY generation ASC, sibling_order ASC`,
      [ancestorId]
    );

    // 获取配偶名称
    const allIds = descendantsResult.rows.map((r) => r.id);
    let spouseNamesMap: Record<number, string[]> = {};

    if (allIds.length > 0) {
      const spousesResult = await pool.query(
        `SELECT fm.id,
                COALESCE(array_agg(sp.name) FILTER (WHERE sp.name IS NOT NULL), '{}') as spouse_names
         FROM family_members fm
         LEFT JOIN LATERAL (
           SELECT name FROM family_members WHERE id = ANY(COALESCE(fm.spouse_ids, '{}'))
         ) sp ON true
         WHERE fm.id = ANY($1)
         GROUP BY fm.id`,
        [allIds]
      );
      spouseNamesMap = Object.fromEntries(
        spousesResult.rows.map((r) => [r.id, r.spouse_names])
      );
    }

    const data: DescendantNode[] = descendantsResult.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      generation: row.generation,
      sibling_order: row.sibling_order,
      father_id: row.father_id ? Number(row.father_id) : null,
      gender: row.gender as DescendantNode["gender"],
      official_position: row.official_position,
      is_alive: row.is_alive ?? true,
      spouse_ids: (row.spouse_ids || []).map(Number),
      spouse_names: spouseNamesMap[Number(row.id)] || [],
      is_married_in: row.is_married_in ?? false,
      remarks: row.remarks,
      birthday: row.birthday ? String(row.birthday) : null,
      death_date: row.death_date ? String(row.death_date) : null,
      residence_place: row.residence_place,
    }));

    const ancestor: DescendantNode = {
      id: Number(ancestorRow.id),
      name: ancestorRow.name,
      generation: ancestorRow.generation,
      sibling_order: ancestorRow.sibling_order,
      father_id: ancestorRow.father_id ? Number(ancestorRow.father_id) : null,
      gender: ancestorRow.gender as DescendantNode["gender"],
      official_position: ancestorRow.official_position,
      is_alive: ancestorRow.is_alive ?? true,
      spouse_ids: (ancestorRow.spouse_ids || []).map(Number),
      spouse_names: spouseNamesMap[Number(ancestorRow.id)] || [],
      is_married_in: ancestorRow.is_married_in ?? false,
      remarks: ancestorRow.remarks,
      birthday: ancestorRow.birthday ? String(ancestorRow.birthday) : null,
      death_date: ancestorRow.death_date ? String(ancestorRow.death_date) : null,
      residence_place: ancestorRow.residence_place,
    };

    return {
      ancestor,
      data,
      error: null,
      descendantCount: data.length,
    };
  } catch (err) {
    console.error("fetchDescendants error:", err);
    return { ancestor: null, data: [], error: formatActionError(err), descendantCount: 0 };
  }
}
