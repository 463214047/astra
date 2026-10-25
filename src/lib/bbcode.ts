/**
 * 轻量 BBCode — 白名单解析器（服务端渲染 / 前端都能用）
 *
 * 支持标签：
 *   [b]...[/b]        粗体
 *   [i]...[/i]        斜体
 *   [u]...[/u]        下划线
 *   [s]...[/s]        删除线
 *   [color=#xxx]...   文字颜色（仅允许 #rrggbb）
 *   [url=...]...[/url]  超链接
 *   [quote]...[/quote]  引用块
 *   [code]...[/code]    等宽代码（防解析）
 *   [img]...[/img]      图片 URL
 *
 * 安全：所有输出经过 escapeHtml，不输出裸 HTML；url/img 仅允许 http(s) + data:image/svg+xml。
 */

const ALLOWED_TAGS = new Set(["b", "i", "u", "s", "color", "url", "quote", "code", "img"]);

/** 转义 HTML */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 清理危险的 URL — 仅允许 http(s) 和 data:image/svg+xml */
function sanitizeUrl(u: string): string | null {
  const t = u.trim();
  if (!t) return null;
  if (/^https?:\/\/[^\s"<>]+$/i.test(t)) return t;
  if (/^data:image\/svg\+xml[^\s"<>]*$/i.test(t)) return t;
  return null;
}

/** 颜色校验 — 仅允许 #rrggbb 或 6 位/3 位十六进制 */
function sanitizeColor(c: string): string | null {
  const t = c.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t;
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    // 扩展为 6 位
    return "#" + t[1] + t[1] + t[2] + t[2] + t[3] + t[3];
  }
  return null;
}

type Token =
  | { type: "text"; value: string }
  | { type: "open"; tag: string; attr?: string }
  | { type: "close"; tag: string };

/** 词法分析 — 把 BBCode 字符串切成 token 流 */
function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let buffer = "";

  const flushText = () => {
    if (buffer) {
      tokens.push({ type: "text", value: buffer });
      buffer = "";
    }
  };

  while (i < src.length) {
    if (src[i] === "[") {
      // 找 ]
      const end = src.indexOf("]", i);
      if (end === -1) {
        buffer += src[i];
        i++;
        continue;
      }
      const raw = src.slice(i + 1, end); // [b] → "b"  [url=xxx] → "url=xxx"  [/b] → "/b"
      const isClose = raw.startsWith("/");
      const inner = isClose ? raw.slice(1) : raw;
      const eqIdx = inner.indexOf("=");
      const tag = (eqIdx === -1 ? inner : inner.slice(0, eqIdx)).toLowerCase();

      if (!ALLOWED_TAGS.has(tag)) {
        // 不允许 — 当作普通文本
        buffer += src.slice(i, end + 1);
        i = end + 1;
        continue;
      }

      flushText();
      if (isClose) {
        tokens.push({ type: "close", tag });
      } else {
        tokens.push({
          type: "open",
          tag,
          attr: eqIdx === -1 ? undefined : inner.slice(eqIdx + 1),
        });
      }
      i = end + 1;
    } else {
      buffer += src[i];
      i++;
    }
  }
  flushText();
  return tokens;
}

/**
 * 语法分析 + 输出 HTML（字符串拼接版，够快且无依赖）
 * 遇到标签不闭合则原样保留
 */
export function renderBBCode(src: string): string {
  if (!src) return "";
  const tokens = tokenize(src);
  const stack: { tag: string; attr?: string }[] = [];
  let out = "";
  let inCode = false;

  const openTag = (tag: string, attr?: string) => {
    stack.push({ tag, attr });
    switch (tag) {
      case "b":
        out += "<strong>";
        break;
      case "i":
        out += "<em>";
        break;
      case "u":
        out += '<span style="text-decoration:underline">';
        break;
      case "s":
        out += "<del>";
        break;
      case "color": {
        const c = sanitizeColor(attr ?? "");
        out += c ? `<span style="color:${c}">` : "";
        break;
      }
      case "url": {
        const href = sanitizeUrl(attr ?? "");
        out += href
          ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">`
          : "";
        break;
      }
      case "quote":
        out += '<blockquote class="border-l-4 border-slate-300 pl-3 text-slate-600 italic my-1">';
        break;
      case "code":
        inCode = true;
        out += '<code class="font-mono bg-slate-100 px-1 py-0.5 rounded text-sm">';
        break;
      case "img": {
        const srcUrl = sanitizeUrl(attr ?? "");
        out += srcUrl
          ? `<img src="${escapeHtml(srcUrl)}" class="inline-block max-w-full max-h-40 rounded my-1" alt="" />`
          : "";
        break;
      }
    }
  };

  const closeTag = (tag: string) => {
    // 找最近一个同 tag 的 open
    const idx = [...stack].reverse().findIndex((s) => s.tag === tag);
    if (idx === -1) {
      // 没匹配的 open — 当作文本（原样输出）
      out += `[/${tag}]`;
      return;
    }
    // 弹出到那个位置
    for (let k = 0; k <= idx; k++) stack.pop();

    switch (tag) {
      case "b":
        out += "</strong>";
        break;
      case "i":
        out += "</em>";
        break;
      case "u":
      case "color":
        out += "</span>";
        break;
      case "s":
        out += "</del>";
        break;
      case "url":
        out += "</a>";
        break;
      case "quote":
        out += "</blockquote>";
        break;
      case "code":
        inCode = false;
        out += "</code>";
        break;
      // img 是自闭合的，close 时什么都不做
    }
  };

  for (const tok of tokens) {
    if (tok.type === "text") {
      if (inCode) {
        out += escapeHtml(tok.value);
      } else {
        // 换行 → <br> 但在 blockquote 内部也要支持
        out += escapeHtml(tok.value).replace(/\n/g, "<br />");
      }
    } else if (tok.type === "open") {
      openTag(tok.tag, tok.attr);
    } else {
      closeTag(tok.tag);
    }
  }

  // 未闭合 — 忽略（不留垃圾标签）
  return out;
}

/**
 * BBCode 输入校验 — 返回错误字符串，null 表示合法
 *
 * 规则：
 *   - 总长度 ≤ 500
 *   - 所有 [xxx] 标签必须白名单
 *   - 必须成对闭合
 *   - url / img 必须是 http(s) 或 data:image/svg+xml
 *   - color 必须是合法十六进制
 */
export function validateBBCode(src: string, maxLen = 500): string | null {
  if (src.length > maxLen) return `签名最多 ${maxLen} 字符`;

  // 不能含裸 HTML 标签
  if (/<\/?[a-z][^>]*>/i.test(src)) return "不允许直接使用 HTML 标签";

  const tokens = tokenize(src);
  const stack: string[] = [];

  for (const tok of tokens) {
    if (tok.type === "open") {
      // 额外校验 attr
      if (tok.tag === "url" || tok.tag === "img") {
        if (!tok.attr) return `[${tok.tag}] 需要 URL`;
        if (!sanitizeUrl(tok.attr)) return `[${tok.tag}] 仅支持 http(s) 链接`;
      }
      if (tok.tag === "color") {
        if (!tok.attr) return "[color=...] 需要颜色值";
        if (!sanitizeColor(tok.attr)) return "[color=...] 必须是 #rrggbb 格式";
      }
      stack.push(tok.tag);
    } else if (tok.type === "close") {
      const last = stack[stack.length - 1];
      if (!last) return `多余的闭合标签 [/${tok.tag}]`;
      if (last !== tok.tag) return `标签不匹配：期望 [/${last}]，实际 [/${tok.tag}]`;
      stack.pop();
    }
  }

  if (stack.length > 0) return `未闭合的标签：[${stack.join("] [")}]`;

  return null;
}
