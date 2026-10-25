"use client";

import { useState } from "react";
import ScreenshotGallery from "./screenshot-gallery";

type Props = {
  coverUrl: string | null;
  screenshotUrls: string[];
  title: string;
};

/**
 * 统一媒体区：封面 + 截图 全部同一尺寸网格
 * 所有图片保持原始宽高比（object-contain），不裁剪
 * 封面图在网格内加「封面」徽章标识
 */
export default function MediaGallery({ coverUrl, screenshotUrls, title }: Props) {
  // 构建统一图片列表
  const items: { url: string; isCover: boolean }[] = [];

  if (coverUrl) {
    items.push({ url: coverUrl, isCover: true });
  }
  for (const s of screenshotUrls) {
    items.push({ url: s, isCover: false });
  }

  if (items.length === 0) return null;

  // Gallery Modal 状态
  const [gallery, setGallery] = useState<{ open: boolean; startIdx: number }>({
    open: false,
    startIdx: 0,
  });

  // 网格响应式列数
  const gridCols =
    items.length === 1
      ? "grid-cols-1"
      : items.length === 2
        ? "grid-cols-2"
        : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4";

  return (
    <>
      <figure className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <figcaption className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-5 py-3">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-slate-900 text-slate-50 text-[10px] font-bold">
            🖼
          </span>
          <span className="text-sm font-semibold text-slate-800">
            {coverUrl ? "封面与截图" : "截图"}
            {items.length > 0 && (
              <span className="ml-2 text-[11px] font-medium text-slate-400">{items.length} 张</span>
            )}
          </span>
        </figcaption>
        <div className="p-2 bg-slate-100">
          <div className={`grid gap-1.5 ${gridCols}`}>
            {items.map((item, i) => (
              <ThumbItem
                key={`${item.url}-${i}`}
                url={item.url}
                isCover={item.isCover}
                title={title}
                onClick={() => setGallery({ open: true, startIdx: i })}
              />
            ))}
          </div>
        </div>
      </figure>

      {/* 放大 Modal */}
      {gallery.open && (
        <ScreenshotGallery
          urls={items.map((it) => it.url)}
          startIndex={gallery.startIdx}
          onClose={() => setGallery({ open: false, startIdx: 0 })}
        />
      )}
    </>
  );
}

function ThumbItem({
  url,
  isCover,
  title,
  onClick,
}: {
  url: string;
  isCover: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-[16/10] overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 transition hover:ring-slate-400 hover:shadow-sm"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={isCover ? `${title} 封面` : `${title} 图片`}
        data-no-translate
        className="h-full w-full object-contain transition group-hover:scale-[1.02]"
        loading="lazy"
      />
      {/* 封面徽章 */}
      {isCover && (
        <span className="absolute left-2 top-2 rounded-md bg-brand-600/95 px-2 py-0.5 text-[13px] font-semibold text-white shadow-sm backdrop-blur">
          封面
        </span>
      )}
      {/* hover 放大指示 */}
      <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/15 group-hover:opacity-100">
        <svg viewBox="0 0 20 20" fill="none" className="size-5 drop-shadow">
          <path
            d="M4 8V4h4M12 4h4v4M16 12v4h-4M8 16H4v-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  );
}
