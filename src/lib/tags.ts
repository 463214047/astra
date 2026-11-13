/**
 * 种子标签配色 —— 发布页选择器 / 详情页 / 列表共用同一套语义色
 * 未知标签（历史数据 / 自定义）按标签名哈希取固定色，保证同标签全局一致
 */
const TAG_STYLES: Record<string, string> = {
  禁转: "bg-rose-500 text-white ring-rose-500/30",
  "LGBTQ+": "bg-fuchsia-500 text-white ring-fuchsia-500/30",
  特效字幕: "bg-sky-500 text-white ring-sky-500/30",
  中字: "bg-emerald-500 text-white ring-emerald-500/30",
  合集: "bg-indigo-500 text-white ring-indigo-500/30",
  无码: "bg-amber-600 text-white ring-amber-600/30",
  NTR: "bg-orange-500 text-white ring-orange-500/30",
};

/** 未知标签的兜底色板（避免全部灰色） */
const FALLBACK_PALETTE = [
  "bg-rose-500 text-white ring-rose-500/30",
  "bg-orange-500 text-white ring-orange-500/30",
  "bg-amber-600 text-white ring-amber-600/30",
  "bg-lime-600 text-white ring-lime-600/30",
  "bg-emerald-500 text-white ring-emerald-500/30",
  "bg-teal-500 text-white ring-teal-500/30",
  "bg-cyan-600 text-white ring-cyan-600/30",
  "bg-sky-500 text-white ring-sky-500/30",
  "bg-blue-500 text-white ring-blue-500/30",
  "bg-indigo-500 text-white ring-indigo-500/30",
  "bg-violet-500 text-white ring-violet-500/30",
  "bg-fuchsia-500 text-white ring-fuchsia-500/30",
  "bg-pink-500 text-white ring-pink-500/30",
  "bg-slate-500 text-white ring-slate-500/30",
];

export function tagStyle(tag: string): string {
  const known = TAG_STYLES[tag];
  if (known) return known;

  // 简单字符串哈希 → 稳定取色
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}
