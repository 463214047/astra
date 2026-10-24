"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  urls: string[];
  /** 受控模式：外部指定起始索引（同时需传 onClose）*/
  startIndex?: number;
  /** 受控模式：关闭回调 */
  onClose?: () => void;
}

export default function ScreenshotGallery({ urls, startIndex, onClose }: Props) {
  // 是否为受控（Modal-only）模式
  const controlled = startIndex !== undefined && !!onClose;

  const [open, setOpen] = useState(controlled);
  const [index, setIndex] = useState(startIndex ?? 0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // 受控模式：startIndex 变化时同步
  useEffect(() => {
    if (controlled) {
      setOpen(true);
      setIndex(startIndex!);
      setScale(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [controlled, startIndex]);

  // 重置视图
  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // 关闭
  const handleClose = useCallback(() => {
    if (controlled) onClose!();
    else setOpen(false);
  }, [controlled, onClose]);

  // 内部模式打开
  const openAt = (i: number) => {
    if (controlled) return;
    setIndex(i);
    resetView();
    setOpen(true);
  };

  // 切换图片时重置
  useEffect(() => {
    resetView();
  }, [index, resetView]);

  // ESC / ← → 键盘
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      else if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + urls.length) % urls.length);
      else if (e.key === "ArrowRight") setIndex((i) => (i + 1) % urls.length);
      else if (e.key === "0") resetView();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, urls.length, resetView, handleClose]);

  // 滚轮缩放
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setScale((s) => Math.min(5, Math.max(0.2, s * (1 + delta))));
  };

  // 拖拽
  const onMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStart.current) return;
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    });
  };
  const endDrag = () => {
    setDragging(false);
    dragStart.current = null;
  };

  // 关闭 Modal（点遮罩）
  const closeOnMask = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  return (
    <>
      {/* 仅非受控模式渲染缩略图网格（受控模式由外部提供 trigger）*/}
      {!controlled && (
        <div className="mt-8 border-t border-slate-100 pt-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">截图 ({urls.length})</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {urls.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => openAt(i)}
                className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100 transition hover:border-slate-400 hover:shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`截图 ${i + 1}`}
                  className="aspect-video w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-medium text-white opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
                  点击查看
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 放大 Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={closeOnMask}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
        >
          {/* 工具栏 */}
          <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white backdrop-blur">
            <span className="font-medium">
              {index + 1} / {urls.length}
            </span>
            <span className="text-white/40">·</span>
            <span>{Math.round(scale * 100)}%</span>
            <span className="text-white/40">·</span>
            <button
              type="button"
              onClick={resetView}
              className="rounded px-2 py-0.5 hover:bg-white/20"
              title="重置 (0)"
            >
              重置
            </button>
            <span className="text-white/40">·</span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(5, s + 0.2))}
              className="rounded px-2 py-0.5 hover:bg-white/20"
              title="放大"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.2, s - 0.2))}
              className="rounded px-2 py-0.5 hover:bg-white/20"
              title="缩小"
            >
              −
            </button>
            <span className="text-white/40">·</span>
            <a
              href={urls[index]}
              target="_blank"
              rel="noreferrer"
              className="rounded px-2 py-0.5 hover:bg-white/20"
              title="在新标签页打开"
            >
              原图
            </a>
          </div>

          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full bg-white/10 text-xl text-white backdrop-blur transition hover:bg-white/25"
            aria-label="关闭"
          >
            ×
          </button>

          {/* 左右切换 */}
          {urls.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setIndex((i) => (i - 1 + urls.length) % urls.length)}
                className="absolute left-4 z-10 grid size-11 place-items-center rounded-full bg-white/10 text-2xl text-white backdrop-blur transition hover:bg-white/25"
                aria-label="上一张"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setIndex((i) => (i + 1) % urls.length)}
                className="absolute right-4 z-10 grid size-11 place-items-center rounded-full bg-white/10 text-2xl text-white backdrop-blur transition hover:bg-white/25"
                aria-label="下一张"
              >
                ›
              </button>
            </>
          )}

          {/* 图片容器 */}
          <div
            className="flex h-full w-full items-center justify-center overflow-hidden"
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            style={{ cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={urls[index]}
              src={urls[index]}
              alt={`图片 ${index + 1}`}
              draggable={false}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transition: dragging ? "none" : "transform 0.15s ease-out",
                maxWidth: scale <= 1 ? "95vw" : "none",
                maxHeight: scale <= 1 ? "85vh" : "none",
                userSelect: "none",
              }}
              className="select-none rounded shadow-2xl"
            />
          </div>

          {/* 底部提示 */}
          <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/5 px-3 py-1.5 text-[11px] text-white/50 backdrop-blur">
            滚轮缩放 · 拖拽平移（放大后） · ← → 切换 · Esc 关闭 · 0 重置
          </div>
        </div>
      )}
    </>
  );
}
