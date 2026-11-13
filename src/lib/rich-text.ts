/**
 * 富文本消息工具 —— 判断 / 纯文本摘要 / 安全渲染
 *
 * 消息中心收到的是 TipTap 生成的 HTML，展示前需要：
 *   1. 列表里压成纯文本摘要
 *   2. 详情里按白名单清洗后再渲染，避免 XSS
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "em",
  "s",
  "del",
  "b",
  "i",
  "u",
  "a",
  "img",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "hr",
  "span",
  "details",
  "summary",
]);

/** 是否包含 HTML 标签 */
export function isRichText(content: string): boolean {
  return /<\/?[a-z][a-z0-9-]*(\s[^>]*)?>/i.test(content);
}

/** HTML → 纯文本（用于列表摘要） */
export function richTextToPlainText(content: string): string {
  if (!isRichText(content)) return content;

  return content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|summary|details)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 从属性串里取指定属性 */
function extractAttr(attrs: string, name: string): string | null {
  const match = attrs.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  return match ? (match[1] ?? match[2] ?? match[3] ?? null) : null;
}

/** 仅允许 http(s) 链接 */
function safeUrl(raw: string | null): string | null {
  if (!raw) return null;
  const url = raw.trim();
  if (!/^https?:\/\/[^\s"'<>]+$/i.test(url)) return null;
  return url;
}

/** 内联样式白名单 — 仅保留 color / font-size */
function sanitizeInlineStyle(value: string): string | null {
  const kept: string[] = [];
  for (const part of value.split(";")) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (prop === "color" && /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(val)) kept.push(`color:${val}`);
    else if (prop === "font-size" && /^\d{1,2}(?:\.\d+)?px$/.test(val))
      kept.push(`font-size:${val}`);
  }
  return kept.length ? kept.join(";") : null;
}

/** HTML 白名单清洗（渲染前必须调用） */
export function sanitizeRichHtml(html: string): string {
  if (!html) return "";

  return html.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g,
    (match, rawName: string, rest: string) => {
      const tag = rawName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (match.startsWith("</")) return `</${tag}>`;

      if (tag === "a") {
        const href = safeUrl(extractAttr(rest, "href"));
        return href
          ? `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">`
          : "<a>";
      }
      if (tag === "img") {
        const src = safeUrl(extractAttr(rest, "src"));
        return src ? `<img src="${src}" alt="" loading="lazy" referrerpolicy="no-referrer">` : "";
      }
      if (tag === "span") {
        const style = sanitizeInlineStyle(extractAttr(rest, "style") ?? "");
        return style ? `<span style="${style}">` : "<span>";
      }
      return `<${tag}>`;
    },
  );
}
