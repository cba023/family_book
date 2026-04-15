/**
 * 族谱「生平事迹」字段：可能为 Slate JSON 字符串、HTML 或纯文本。
 * 导出 PDF / 打印时使用纯文本，避免整段 JSON 出现在版面上。
 */

function normalizeWs(s: string): string {
  return s
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** 递归收集 Slate / 类 Slate 节点中的 text 叶子 */
function collectTextFromNode(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (typeof n.text === "string") return n.text;
  if (Array.isArray(n.children)) {
    return n.children.map(collectTextFromNode).join("");
  }
  return "";
}

/**
 * 将 remarks 转为可读纯文本（不含 JSON 结构关键字）。
 */
export function remarksToPlainText(raw: string | null | undefined): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (s === "") return "";

  const tryJson =
    (s.startsWith("[") && s.endsWith("]")) ||
    (s.startsWith("{") && s.endsWith("}"));
  if (tryJson) {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) {
        const lines = parsed
          .map((block) => collectTextFromNode(block).trim())
          .filter(Boolean);
        const t = lines.join("\n");
        if (t.length > 0) return normalizeWs(t);
      } else if (parsed && typeof parsed === "object") {
        const t = collectTextFromNode(parsed).trim();
        if (t.length > 0) return normalizeWs(t);
      }
    } catch {
      /* 非合法 JSON，按正文处理 */
    }
  }

  if (/<[a-z][\s\S]*>/i.test(s)) {
    return normalizeWs(stripHtmlTags(s));
  }
  return normalizeWs(s);
}

/** 有内容才返回截断后的字符串，否则 null（用于导出时「缺省不展示」） */
export function optionalTrunc(v: unknown, max: number): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  if (t === "") return null;
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}
