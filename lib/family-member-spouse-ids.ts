import { numId } from "@/lib/auth/session";

/** 配偶 ID 去重并保持数据库/表单中的顺序（长房、次房等人工排序） */
export function dedupeSpouseIdsPreserveOrder(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const v of raw) {
    const id = numId(v);
    if (!isNaN(id) && id > 0 && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
