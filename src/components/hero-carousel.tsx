"use client";

import { useState, useEffect, useCallback } from "react";

interface Slide {
  title: string;
  subtitle: string;
  badge?: string;
  gradient: string;
  blobs: { className: string; color: string }[];
  duoButtons?: boolean;
  cta?: string;
  href?: string;
}

const SLIDES: Slide[] = [
  {
    badge: "Astra PT",
    title: "发现同好，分享热爱",
    subtitle: "游戏、动漫、漫画、影视等等 一切你感兴趣的内容，都能在这里找到同好。",
    gradient: "bg-gradient-to-br from-slate-900 via-brand-900 to-brand-950",
    blobs: [
      { className: "-right-20 -top-20 size-60", color: "bg-brand-500/20" },
      { className: "-bottom-16 -left-10 size-48", color: "bg-brand-400/20" },
    ],
    duoButtons: true,
  },
];

const INTERVAL = 5000;
// iOS 风格快起慢停缓动
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const TRANSITION_MS = 550;

export default function HeroCarousel() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((delta: number) => {
    setIdx((i) => (i + delta + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (paused || SLIDES.length <= 1) return;
    const t = setInterval(() => go(1), INTERVAL);
    return () => clearInterval(t);
  }, [paused, go]);

  const hasMultiple = SLIDES.length > 1;

  return (
    <section
      className="group relative mb-8 overflow-hidden rounded-3xl border border-slate-200"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Track —— flex 横排所有 slide，整排 translateX 滑动 */}
      <div
        className="flex"
        style={{
          transform: `translateX(-${idx * 100}%)`,
          transition: `transform ${TRANSITION_MS}ms ${EASE}`,
          willChange: "transform",
        }}
      >
        {SLIDES.map((s, i) => (
          <div key={i} className={`relative w-full shrink-0 ${s.gradient}`}>
            {/* 背景光斑 */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {s.blobs.map((b, bi) => (
                <div
                  key={bi}
                  className={`absolute rounded-full blur-3xl ${b.className} ${b.color}`}
                />
              ))}
            </div>

            {/* 内容 */}
            <div className="relative p-6 sm:p-10">
              {s.badge && (
                <p className="text-xs font-medium uppercase tracking-widest text-brand-300/80">
                  {s.badge}
                </p>
              )}
              <h1 className="mt-3 text-2xl font-bold leading-tight text-white sm:text-4xl">
                {s.title}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-slate-300 sm:text-base">{s.subtitle}</p>

              {s.duoButtons ? (
                <div className="mt-5 flex items-center gap-3">
                  <a
                    href="/rules"
                    className="rounded-full bg-white px-5 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100 active:scale-95"
                  >
                    规则
                  </a>
                  <a
                    href="/contact"
                    className="rounded-full border border-white/30 px-5 py-2 text-sm font-medium text-white transition hover:bg-white/10 active:scale-95"
                  >
                    联系管理
                  </a>
                </div>
              ) : s.cta ? (
                <a
                  href={s.href ?? "#"}
                  className="mt-5 inline-flex items-center rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20 active:scale-95"
                >
                  {s.cta}
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/*  Controls */}
      {hasMultiple && (
        <>
          <button
            type="button"
            aria-label="上一张"
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white/80 backdrop-blur opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-black/50 hover:text-white sm:p-2"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-4 sm:size-5"
            >
              <path d="m12 4-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="下一张"
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white/80 backdrop-blur opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-black/50 hover:text-white sm:p-2"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-4 sm:size-5"
            >
              <path d="m8 4 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/*  Indicators */}
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`跳到第 ${i + 1} 张`}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </>
      )}

      {/*  Progress bar */}
      {hasMultiple && !paused && (
        <div
          key={idx}
          className="absolute bottom-0 left-0 z-20 h-0.5 origin-left bg-white/50 animate-[shrink_5000ms_linear_forwards]"
        />
      )}

      <style jsx>{`
        @keyframes shrink {
          from {
            transform: scaleX(1);
          }
          to {
            transform: scaleX(0);
          }
        }
      `}</style>
    </section>
  );
}
