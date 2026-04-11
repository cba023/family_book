"use server";

import { requireUser, requireAdmin, numId } from "@/lib/auth/session";
import { formatActionError } from "@/lib/format-action-error";
import { createClient } from "@/lib/supabase/server";
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
    official_position: item.official_position != null ? String(item.official_position) : null,
    is_alive: Boolean(item.is_alive),
    spouse_id: sid,
    spouse_name: sid ? spouseMap[sid] ?? null : null,
    is_married_in: Boolean(item.is_married_in),
    remarks: item.remarks != null ? String(item.remarks) : null,
    birthday: item.birthday != null ? String(item.birthday) : null,
    death_date: item.death_date != null ? String(item.death_date) : null,
    residence_place: item.residence_place != null ? String(item.residence_place) : null,
    updated_at:
      item.updated_at != null ? String(item.updated_at) : new Date().toISOString(),
  };
}

export async function fetchFamilyMembers(
  page: number = 1,
  pageSize: number = 50,
  searchQuery: string = "",
): Promise<FetchMembersResult> {
  const { supabase, user, error: authError } = await requireAdmin();
  if (!user) {
    return { data: [], count: 0, error: authError };
  }

  try {
    const offset = (page - 1) * pageSize;

    let q = supabase
      .from("family_members")
      .select("*", { count: "exact" });

    const term = searchQuery.trim();
    if (term) {
      q = q.ilike("name", `%${term}%`);
    }

    const { data, error, count } = await q
      .order("generation", { ascending: true, nullsFirst: true })
      .order("sibling_order", { ascending: true, nullsFirst: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    const rows = (data ?? []) as Record<string, unknown>[];
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
      const { data: fathers, error: fe } = await supabase
        .from("family_members")
        .select("id,name")
        .in("id", fatherIds);
      if (fe) throw fe;
      fatherMap = Object.fromEntries(
        (fathers ?? []).map((f) => [numId(f.id), String(f.name)]),
      );
    }

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

    const transformedData = rows.map((item) =>
      mapMemberRow(item, fatherMap, spouseMap),
    );

    return {
      data: transformedData,
      count: count ?? 0,
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
  const { supabase, user, error: authError } = await requireAdmin();
  if (!user) {
    return { success: false, error: authError };
  }

  try {
    const alive = input.is_alive ?? true;
    const { data: inserted, error: insErr } = await supabase
      .from("family_members")
      .insert({
        user_id: user.id,
        name: input.name,
        generation: input.generation ?? null,
        sibling_order: input.sibling_order ?? null,
        father_id: input.father_id ?? null,
        gender: input.gender ?? null,
        official_position: input.official_position ?? null,
        is_alive: alive,
        spouse_id: input.spouse_id ?? null,
        is_married_in: Boolean(input.is_married_in),
        remarks: input.remarks ?? null,
        birthday: input.birthday ?? null,
        death_date: input.death_date ?? null,
        residence_place: input.residence_place ?? null,
      })
      .select("id")
      .single();

    if (insErr) throw insErr;
    const newMemberId = numId(inserted.id);

    if (input.spouse_id) {
      const { error: upErr } = await supabase
        .from("family_members")
        .update({
          spouse_id: newMemberId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.spouse_id);
      if (upErr) throw upErr;
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
  const { supabase, user, error: authError } = await requireAdmin();
  if (!user) {
    return { success: false, error: authError };
  }

  if (ids.length === 0) {
    return { success: false, error: "没有选择要删除的成员" };
  }

  try {
    const { error } = await supabase.from("family_members").delete().in("id", ids);
    if (error) throw error;

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
  const { supabase, user, error: authError } = await requireAdmin();
  if (!user) {
    console.error("fetchAllMembersForSelect:", authError);
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("family_members")
      .select("id, name, generation, gender, is_married_in, father_id, spouse_id")
      .order("generation", { ascending: true, nullsFirst: true })
      .order("name", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((m) => ({
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
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("family_members")
      .select("*")
      .order("generation", { ascending: true, nullsFirst: true })
      .order("sibling_order", { ascending: true, nullsFirst: true });

    if (error) throw error;

    const rows = (data ?? []) as Record<string, unknown>[];
    const fatherIds = rows
      .map((r) => r.father_id)
      .filter((id): id is number | string => id != null)
      .map(numId);

    let fatherMap: Record<number, string> = {};
    if (fatherIds.length > 0) {
      const { data: fathers } = await supabase
        .from("family_members")
        .select("id,name")
        .in("id", fatherIds);
      fatherMap = Object.fromEntries(
        (fathers ?? []).map((f) => [numId(f.id), String(f.name)]),
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

    // 检查用户是否登录
    const { user } = await requireUser();

    return { data: members, requireAuth: !user };
  } catch (error) {
    console.error("Error fetching members for timeline:", error);
    return { data: [], requireAuth: false };
  }
}

export async function fetchMemberById(id: number): Promise<FamilyMember | null> {
  const { supabase, user, error: authError } = await requireUser();
  if (!user) {
    console.error("fetchMemberById:", authError);
    return null;
  }

  try {
    const { data: item, error } = await supabase
      .from("family_members")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!item) return null;

    let father_name: string | null = null;
    if (item.father_id != null) {
      const { data: father } = await supabase
        .from("family_members")
        .select("name")
        .eq("id", numId(item.father_id))
        .maybeSingle();
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
  const { supabase, user, error: authError } = await requireAdmin();
  if (!user) {
    return { success: false, error: authError };
  }

  try {
    const { data: currentMember, error: curErr } = await supabase
      .from("family_members")
      .select("spouse_id")
      .eq("id", input.id)
      .single();

    if (curErr) throw curErr;

    const oldSpouseId =
      currentMember?.spouse_id != null
        ? numId(currentMember.spouse_id)
        : null;
    const newSpouseId = input.spouse_id ?? null;

    const alive = input.is_alive ?? true;

    const { error: upErr } = await supabase
      .from("family_members")
      .update({
        name: input.name,
        generation: input.generation ?? null,
        sibling_order: input.sibling_order ?? null,
        father_id: input.father_id ?? null,
        gender: input.gender ?? null,
        official_position: input.official_position ?? null,
        is_alive: alive,
        spouse_id: newSpouseId,
        is_married_in: Boolean(input.is_married_in),
        remarks: input.remarks ?? null,
        birthday: input.birthday ?? null,
        death_date: input.death_date ?? null,
        residence_place: input.residence_place ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);

    if (upErr) throw upErr;

    if (newSpouseId && newSpouseId !== oldSpouseId) {
      const { error: e2 } = await supabase
        .from("family_members")
        .update({
          spouse_id: input.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", newSpouseId);
      if (e2) throw e2;
    }

    if (oldSpouseId && oldSpouseId !== newSpouseId) {
      const { error: e3 } = await supabase
        .from("family_members")
        .update({
          spouse_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", oldSpouseId);
      if (e3) throw e3;
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
  const { supabase, user, error: authError } = await requireAdmin();
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
      const { data: foundFathers, error: fe } = await supabase
        .from("family_members")
        .select("id,name")
        .in("name", fatherNames);
      if (fe) throw fe;
      for (const f of foundFathers ?? []) {
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

      const { data: inserted, error: insErr } = await supabase
        .from("family_members")
        .insert({
          user_id: user.id,
          name: m.name,
          generation: m.generation ?? null,
          sibling_order: m.sibling_order ?? null,
          father_id,
          gender: m.gender ?? null,
          official_position: m.official_position ?? null,
          is_alive: alive,
          spouse_id: null,
          is_married_in: false,
          remarks: m.remarks ?? null,
          birthday: m.birthday ?? null,
          death_date: null,
          residence_place: m.residence_place ?? null,
        })
        .select("id")
        .single();

      if (insErr) throw insErr;
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
        const { data: row } = await supabase
          .from("family_members")
          .select("id")
          .eq("name", spouseName)
          .limit(1)
          .maybeSingle();
        spouseId = row ? numId(row.id) : undefined;
      }
      if (spouseId === undefined) continue;

      const { error: e1 } = await supabase
        .from("family_members")
        .update({
          spouse_id: spouseId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selfId);
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from("family_members")
        .update({
          spouse_id: selfId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", spouseId);
      if (e2) throw e2;
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
  const { supabase, user, error: authError } = await requireAdmin();
  if (!user) {
    return { data: [], error: authError };
  }

  try {
    const { data, error } = await supabase
      .from("family_members")
      .select("*")
      .order("generation", { ascending: true, nullsFirst: true })
      .order("sibling_order", { ascending: true, nullsFirst: true });

    if (error) throw error;

    return { data: (data ?? []) as Record<string, unknown>[], error: null };
  } catch (error) {
    console.error("Error exporting family members:", error);
    return {
      data: [],
      error: formatActionError(error),
    };
  }
}
