/** PostgREST / Supabase 抛出的常为普通对象，不是 Error 实例 */
export function formatActionError(error: unknown): string {
  if (error == null) return "未知错误";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  if (typeof error === "object" && error !== null && "details" in error) {
    const d = (error as { details?: unknown }).details;
    if (typeof d === "string" && d.length > 0) return d;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "操作失败";
  }
}
