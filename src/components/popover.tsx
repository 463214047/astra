"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Popover 下拉面板 — 点击外部自动关闭
 */
export default function Popover({
  trigger,
  children,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="select-none text-[11px] font-medium uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors inline-flex items-center gap-1"
      >
        {trigger}
        <span className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-2 max-h-[480px] w-[480px] max-w-[80vw] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 shadow-xl">
          {children}
        </div>
      )}
    </div>
  );
}
