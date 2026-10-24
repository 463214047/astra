/**
 * 种子标签配色 —— 发布页选择器 / 详情页 / 列表共用同一套语义色
 * 未知标签（历史数据 / 自定义）退回默认灰色
 */
export const TAG_STYLES: Record<string, string> = {
  "禁转":     "bg-rose-100 text-rose-700 ring-rose-200",
  "LGBTQ+":   "bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200",
  "特效字幕": "bg-sky-100 text-sky-700 ring-sky-200",
  "中字":     "bg-sky-100 text-sky-700 ring-sky-200",
  "合集":     "bg-indigo-100 text-indigo-700 ring-indigo-200",
  "无码":     "bg-amber-100 text-amber-700 ring-amber-200",
  "NTR":      "bg-orange-100 text-orange-700 ring-orange-200",
};

export function tagStyle(tag: string): string {
  return TAG_STYLES[tag] ?? "bg-slate-100 text-slate-600 ring-slate-200";
}
