import { tagStyle } from "@/lib/tags";

/**
 * 种子标签胶囊（展示用）—— 无 # 前缀、带语义背景色
 * 详情页 / 列表共用；配色与发布页选择器同源（src/lib/tags.ts）
 */
export default function PostTag({ tag }: { tag: string }) {
  return (
    <span
      data-no-translate
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ring-1 ring-inset ${tagStyle(tag)}`}
    >
      {tag}
    </span>
  );
}
