"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 长文本折叠 — 默认截断为 4 行，超出时显示「展开/收起」
 * 挂载后实测是否溢出（不靠字数估算），窗口尺寸变化会自动重测
 */
export default function ExpandableText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    if (open) return;
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, open]);

  return (
    <div className={className}>
      <p
        ref={ref}
        className={`whitespace-pre-wrap text-[14px] leading-6 text-slate-600 ${
          open ? "" : "line-clamp-4"
        }`}
      >
        {text}
      </p>
      {(overflowing || open) && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 text-xs text-slate-400 transition-colors hover:text-slate-600"
        >
          {open ? "收起" : "展开"}
        </button>
      )}
    </div>
  );
}
