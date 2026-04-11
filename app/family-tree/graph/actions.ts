"use server";

import { requireUser, numId } from "@/lib/auth/session";
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
  const { supabase, user, error: authError } = await requireUser();
  if (!user) {
    return { data: [], error: authError };
  }

  try {
    const { data, error } = await supabase
      .from("family_members")
      .select(
        "id, name, generation, sibling_order, father_id, gender, official_position, is_alive, spouse_id, is_married_in, remarks, birthday, death_date, residence_place",
      )
      .eq("is_married_in", false)
      .order("generation", { ascending: true, nullsFirst: true })
      .order("sibling_order", { ascending: true, nullsFirst: true });

    if (error) throw error;

    const rows = (data ?? []) as Record<string, unknown>[];
    const spouseIds = rows
      .map((item) => item.spouse_id)
      .filter((id): id is number | string => id != null)
      .map(numId);

    let spouseMap: Record<number, string> = {};
    if (spouseIds.length > 0) {
      const { data: spouses, error: se } = await supabase
        .from("family_members")
        .select("id,name")
        .in("id", spouseIds);
      if (se) throw se;
      spouseMap = Object.fromEntries(
        (spouses ?? []).map((s) => [numId(s.id), String(s.name)]),
      );
    }

    const transformedData: FamilyMemberNode[] = rows.map((item) => {
      const sid = item.spouse_id != null ? numId(item.spouse_id) : null;
      return {
        id: numId(item.id),
        name: String(item.name),
        generation: item.generation != null ? Number(item.generation) : null,
        sibling_order:
          item.sibling_order != null ? Number(item.sibling_order) : null,
        father_id: item.father_id != null ? numId(item.father_id) : null,
        gender: (item.gender as FamilyMemberNode["gender"]) ?? null,
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
  const { supabase, user, error: authError } = await requireUser();
  if (!user) {
    console.error("fetchMemberById graph:", authError);
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("family_members")
      .select(
        "id, name, generation, sibling_order, father_id, gender, official_position, is_alive, spouse_id, is_married_in, remarks, birthday, death_date, residence_place",
      )
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const item = data as Record<string, unknown>;
    let spouse_name: string | null = null;
    if (item.spouse_id != null) {
      const { data: spouse } = await supabase
        .from("family_members")
        .select("name")
        .eq("id", numId(item.spouse_id))
        .maybeSingle();
      spouse_name = spouse?.name != null ? String(spouse.name) : null;
    }

    const sid = item.spouse_id != null ? numId(item.spouse_id) : null;
    return {
      id: numId(item.id),
      name: String(item.name),
      generation: item.generation != null ? Number(item.generation) : null,
      sibling_order:
        item.sibling_order != null ? Number(item.sibling_order) : null,
      father_id: item.father_id != null ? numId(item.father_id) : null,
      gender: (item.gender as FamilyMemberNode["gender"]) ?? null,
      official_position:
        item.official_position != null ? String(item.official_position) : null,
      is_alive: Boolean(item.is_alive),
      spouse_id: sid,
      spouse_name,
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
