"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  torrentName: string;
  href: string;
}

/**
 * 下载按钮
 * - 左键：原生下载（不复制、不提示）
 * - 右键：拦截浏览器菜单，直接复制链接 + toast
 */
export default function DownloadButton({ torrentName, href }: Props) {
  const [showToast, setShowToast] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(href);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = href;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* noop */
      }
      document.body.removeChild(ta);
    }
    setShowToast(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowToast(false), 1400);
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    doCopy();
  };

  return (
    <span className="relative inline-flex">
      <a
        href={href}
        download={torrentName}
        onContextMenu={handleContextMenu}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-800"
        title="右键复制链接"
      >
        <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
          <path
            d="M10 3v10m0 0-3.5-3.5M10 13l3.5-3.5M4 15.5h12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        下载
      </a>

      {showToast && (
        <span
          role="status"
          className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-50 shadow-md animate-[fadeIn_.12s_ease-out]"
        >
          ✓ 链接已复制
        </span>
      )}
    </span>
  );
}
