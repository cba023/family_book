/**
 * 族谱语义：「嫁入」仅适用于女性；男性即使有多位配偶也不是嫁入。
 * 写入库、列表展示、世系图筛选均应对齐此规则。
 */
export function normalizedIsMarriedIn(
  gender: "男" | "女" | null | undefined,
  isMarriedIn: boolean | undefined | null,
): boolean {
  return gender === "女" && Boolean(isMarriedIn);
}
