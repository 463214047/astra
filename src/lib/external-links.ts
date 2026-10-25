/**
 * 外部链接 — 数据格式兼容层
 *
 * 新格式（推荐，POST/PUT 写入）：
 *   [{ "name": "豆瓣", "url": "https://..." }, ...]
 *   DB 里存 JSON 字符串
 *
 * 旧格式（历史数据）：
 *   "\nhttps://douban.com/...\nhttps://..."
 *   纯文本，每行一个 URL（旧豆瓣链接）
 *
 * 所有读取都通过 parseExternalLinks 统一成数组，
 * 所有写入都通过 serializeExternalLinks 统一存 JSON。
 */

export interface ExternalLink {
  name: string;
  url: string;
}

const HTTP_URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

/** 校验 URL 是否合法 http(s) */
function isValidHttpUrl(url: string): boolean {
  return HTTP_URL_RE.test(url.trim());
}

/** 校验 URL（更严格：拒绝带空格、超长等） */
export function validateExternalLinks(
  links: unknown,
): { ok: true; value: ExternalLink[] } | { ok: false; message: string } {
  if (links == null || links === "") return { ok: true, value: [] };
  if (!Array.isArray(links)) {
    // 旧格式：换行分隔字符串 — 自动转新格式
    if (typeof links === "string") {
      const lines = links
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const arr: ExternalLink[] = [];
      for (const url of lines) {
        if (!isValidHttpUrl(url)) {
          return { ok: false, message: `无效的链接：${url}` };
        }
        // 自动猜名称
        const name = guessName(url);
        arr.push({ name, url });
      }
      return { ok: true, value: arr };
    }
    return { ok: false, message: "外部链接格式错误" };
  }

  const arr: ExternalLink[] = [];
  for (let i = 0; i < links.length; i++) {
    const item = links[i];
    if (!item || typeof item !== "object") {
      return { ok: false, message: `第 ${i + 1} 个链接格式错误` };
    }
    const record = item as Record<string, unknown>;
    const name = String(record.name ?? "").trim();
    const url = String(record.url ?? "").trim();
    if (!name) return { ok: false, message: `第 ${i + 1} 个链接缺少名称` };
    if (!url) return { ok: false, message: `第 ${i + 1} 个链接缺少地址` };
    if (!isValidHttpUrl(url)) return { ok: false, message: `第 ${i + 1} 个链接地址无效：${url}` };
    arr.push({ name, url });
  }
  return { ok: true, value: arr };
}

/** 解析 DB 里 external_link 列的值（可能是 JSON 或旧格式纯文本） */
export function parseExternalLinks(raw: string | null | undefined): ExternalLink[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // 尝试 JSON 解析（新格式）
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((x) => x && typeof x === "object" && typeof x.url === "string")
          .map((x) => ({
            name: String(x.name ?? guessName(x.url)).trim(),
            url: String(x.url).trim(),
          }));
      }
    } catch {
      /* fallthrough */
    }
  }

  // 旧格式：每行一个 URL
  return trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((url) => ({ name: guessName(url), url }));
}

/** 序列化存 DB */
export function serializeExternalLinks(links: ExternalLink[]): string | null {
  if (!links.length) return null;
  return JSON.stringify(links);
}

/** 根据域名自动猜名称 */
function guessName(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("douban.com")) return "豆瓣";
    if (host.includes("themoviedb.org")) return "TMDB";
    if (host.includes("pan.baidu.com") || host.includes("baidu.com")) return "百度网盘";
    // 默认：取域名第一部分
    const parts = host.split(".");
    return parts[parts.length - 2]?.toUpperCase() ?? "外链";
  } catch {
    return "外链";
  }
}
