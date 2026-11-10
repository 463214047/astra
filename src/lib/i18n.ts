import { EN_MESSAGES } from "./i18n-en";
import { TRADITIONAL_CHARS, TRADITIONAL_PHRASES } from "./i18n-zh-tw";

export const LOCALE_COOKIE = "astra-locale";
export const DEFAULT_LOCALE = "zh-CN";

export const LOCALES = [
  {
    id: "zh-CN",
    label: "简体中文",
    shortLabel: "简",
    description: "默认界面",
  },
  {
    id: "zh-TW",
    label: "繁體中文",
    shortLabel: "繁",
    description: "港澳台及海外华人",
  },
  {
    id: "en",
    label: "English",
    shortLabel: "EN",
    description: "国际",
  },
] as const;

export type Locale = (typeof LOCALES)[number]["id"];

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.some((locale) => locale.id === value);
}

export function getLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

const PHRASES = [...TRADITIONAL_PHRASES].sort((a, b) => b[0].length - a[0].length);

/** Convert Simplified Chinese UI copy to Traditional Chinese. */
export function toTraditional(text: string): string {
  let converted = text;
  for (const [from, to] of PHRASES) {
    if (converted.includes(from)) converted = converted.split(from).join(to);
  }
  let result = "";
  for (const char of converted) {
    result += TRADITIONAL_CHARS[char] ?? char;
  }
  return result;
}

/**
 * Text nodes split by React interpolation (for example `共 {n} 条`) need
 * segment translations. These are matched against the raw text node, including
 * surrounding whitespace, so they do not affect standalone words.
 */
const EN_SEGMENTS: Array<[string, string]> = [
  ["共 ", "Total "],
  [" 条", " items"],
  ["发布于 ", "Published "],
  ["剩余 ", ""],
  ["已获得 ", "Earned "],
  [" 天彩虹昵称", " days of Rainbow Nickname"],
  ["有 ", ""],
  [" 天奖品待使用", " prize days available"],
  ["使用 ", "Use "],
  [" 天奖品", " prize days"],
  ["最多上传 ", "Up to "],
  [" 张截图", " screenshots"],
  ["请等待 ", "Please wait "],
  [" 秒后再试", " seconds and try again"],
  ["昵称长度 ", "Nickname length "],
  [" 字符", " characters"],
  ["签名最多 ", "Signature max "],
  ["图片 ", "Image "],
  ["截图 ", "Screenshot "],
  ["移除 ", "Remove "],
  [" 人评分", " ratings"],
  [" 季", " seasons"],
  [" 集", " episodes"],
  [" 小时/集", " hr/episode"],
  [" 小时", " hr"],
  [" 分钟/集", " min/episode"],
  [" 分钟", " min"],
];

type PatternReplacement = string | ((...groups: string[]) => string);

function formatEnglishDate(year: string, month: string, day: string): string {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

const EN_PATTERNS: Array<[RegExp, PatternReplacement]> = [
  [/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, (year, month, day) => formatEnglishDate(year, month, day)],
  [/^(\d{4})-(\d{1,2})-(\d{1,2})$/, (year, month, day) => formatEnglishDate(year, month, day)],
  [/^(\d+)魔力$/, "$1 Magic"],
  [/^(\d+)\s*分钟前$/, "$1 min ago"],
  [/^(\d+)\s*小时前$/, "$1 hr ago"],
  [/^(\d+)\s*天前$/, (days) => `${days} ${days === "1" ? "day" : "days"} ago`],
  [/^昨天 (\d{1,2}:\d{2})$/, "Yesterday $1"],
  [/^(\d+) 人评分$/, (count) => `${count} ${count === "1" ? "rating" : "ratings"}`],
  [/^([\d.]+) 万$/, (value) => `${Math.round(Number(value) * 10)}K`],
  [/^(\d+) 季$/, (count) => `${count} ${count === "1" ? "season" : "seasons"}`],
  [/^(\d+) 集$/, (count) => `${count} ${count === "1" ? "episode" : "episodes"}`],
  [
    /^(\d+) 季 · (\d+) 集$/,
    (seasons, episodes) =>
      `${seasons} ${seasons === "1" ? "season" : "seasons"} · ${episodes} ${
        episodes === "1" ? "episode" : "episodes"
      }`,
  ],
  [
    /^(\d+) 季 · (\d+) 集 · (\d+) 分钟\/集$/,
    (seasons, episodes, minutes) =>
      `${seasons} ${seasons === "1" ? "season" : "seasons"} · ${episodes} ${
        episodes === "1" ? "episode" : "episodes"
      } · ${minutes} min/episode`,
  ],
  [/^(\d+) 分钟\/集$/, "$1 min/episode"],
  [/^(\d+) 分钟$/, "$1 min"],
  [/^(\d+) 张$/, "$1"],
  [/^第 (\d+) 张$/, "Image $1"],
  [/^共 (\d+) 条$/, "$1 total"],
  [/^剩余 (\d+) 天$/, (count) => `${count} ${count === "1" ? "day" : "days"} left`],
  [
    /^已获得 (\d+) 天彩虹昵称$/,
    (count) => `Earned ${count} ${count === "1" ? "day" : "days"} of Rainbow Nickname`,
  ],
  [
    /^有 (\d+) 天奖品待使用$/,
    (count) => `${count} prize ${count === "1" ? "day" : "days"} available`,
  ],
  [/^使用 (\d+) 天奖品$/, (count) => `Use ${count} prize ${count === "1" ? "day" : "days"}`],
  [
    /^最多上传 (\d+) 张截图，请先移除已选截图$/,
    "Up to $1 screenshots can be uploaded. Remove some first.",
  ],
  [
    /^最多上传 (\d+) 张截图，已忽略多余的 (\d+) 张$/,
    "Up to $1 screenshots can be uploaded. $2 extra were ignored.",
  ],
  [/^只能上传 (\d+) 张图片，请先移除已选图片$/, "Only $1 image can be uploaded. Remove it first."],
  [
    /^只能上传 (\d+) 张图片，已忽略多余的图片$/,
    "Only $1 image can be uploaded. Extra images were ignored.",
  ],
  [/^昵称长度 (\d+)-(\d+) 字符$/, "Nickname length $1-$2 characters"],
  [/^昵称长度 1-(\d+) 字符$/, "Nickname length 1-$1 characters"],
  [/^签名最多 (\d+) 字符$/, "Signature max $1 characters"],
  [/^请等待 (\d+) 秒后再试$/, "Please wait $1 seconds and try again"],
  [/^跳到第 (\d+) 张$/, "Go to image $1"],
  [/^图片 (\d+)$/, "Image $1"],
  [/^截图 (\d+)$/, "Screenshot $1"],
  [/^移除 (.+)$/, "Remove $1"],
  [/^「(.+)」上传失败$/, 'Failed to upload "$1"'],
  [/^第 (\d+) 个链接格式错误$/, "Link $1 has an invalid format"],
  [/^第 (\d+) 个链接缺少名称$/, "Link $1 is missing a name"],
  [/^第 (\d+) 个链接缺少地址$/, "Link $1 is missing a URL"],
  [/^第 (\d+) 个链接地址无效：(.+)$/, "Link $1 has an invalid URL: $2"],
  [/^无效的链接：(.+)$/, "Invalid link: $1"],
  [
    /^已识别 TMDB (剧集|电影) #(\d+)，详情页将展示作品介绍$/,
    (type, id) =>
      `Recognized TMDB ${type === "剧集" ? "TV series" : "movie"} #${id}. The details page will show an overview.`,
  ],
  [/^(\d+) 秒$/, "$1s"],
  [/^(\d+) 小时$/, "$1 hr"],
  [/^(\d+) 天$/, (count) => `${count} ${count === "1" ? "day" : "days"}`],
  [/^(.+)的个人主页$/, "$1's profile"],
  [/^(.+)的主页$/, "$1's profile"],
  [/^(.+)的收藏$/, "$1's favorites"],
  [/^(.+)的发布$/, "$1's uploads"],
  [/^(.+)的做种$/, "$1's seeding"],
  [/^(.+) 图片$/, "$1 image"],
  [/^(.+) 截图$/, "$1 screenshot"],
];

function preserveWhitespace(source: string, trimmed: string, translated: string): string {
  const start = source.indexOf(trimmed);
  if (start < 0) return translated;
  return source.slice(0, start) + translated + source.slice(start + trimmed.length);
}

function translateEnglish(text: string): string | null {
  if (!text.trim()) return null;

  // Raw matches are needed for text nodes that intentionally contain spaces.
  const raw = EN_MESSAGES[text] ?? EN_SEGMENTS.find(([source]) => source === text)?.[1];
  if (raw !== undefined) return raw;

  const trimmed = text.trim();
  const exact = EN_MESSAGES[trimmed];
  if (exact !== undefined) return preserveWhitespace(text, trimmed, exact);

  for (const [pattern, replacement] of EN_PATTERNS) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    const translated =
      typeof replacement === "function"
        ? replacement(...match.slice(1))
        : trimmed.replace(pattern, replacement);
    return preserveWhitespace(text, trimmed, translated);
  }

  return null;
}

/**
 * Translate a text node or attribute value.
 *
 * Returns `null` when the input should stay as-is. English only translates
 * known UI copy, while Traditional Chinese converts any Han text that reaches
 * the DOM (user-generated content is excluded by the DOM walker).
 */
export function translateText(text: string, locale: Locale): string | null {
  if (locale === "zh-CN") return null;
  if (locale === "zh-TW") {
    if (!/[\u3400-\u9fff]/.test(text)) return null;
    const converted = toTraditional(text);
    return converted === text ? null : converted;
  }
  return translateEnglish(text);
}

export function translateDocumentTitle(title: string, locale: Locale): string | null {
  const suffix = " - DeepSeed";
  if (!title.endsWith(suffix)) return translateText(title, locale);

  let base = title.slice(0, -suffix.length);
  const separator = " · ";
  const separatorIndex = base.lastIndexOf(separator);

  if (separatorIndex > 0) {
    const tail = base.slice(separatorIndex + separator.length);
    const translatedTail = translateText(tail, locale);
    if (translatedTail !== null) {
      base = base.slice(0, separatorIndex + separator.length) + translatedTail;
      return base + suffix;
    }
  }

  if (locale === "zh-TW") {
    const profileTitle = base.match(/^(.+?)(的个人主页|的主页|的收藏|的发布|的做种)$/);
    if (profileTitle) {
      const translatedSuffix = translateText(profileTitle[2], locale);
      return profileTitle[1] + (translatedSuffix ?? profileTitle[2]) + suffix;
    }
  }

  const translated = translateText(base, locale);
  return translated === null ? null : translated + suffix;
}
