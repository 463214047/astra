"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import PostsTable from "./posts-table";
import PostsWaterfall from "./posts-waterfall";
import type { HomePost } from "@/app/(protected)/page";

type CategoryMeta = { label: string; tagBg: string; tagText: string; emoji: string };

interface Props {
  posts: HomePost[];
  categoryMeta: Record<string, CategoryMeta>;
  fallbackGradient: Record<string, string>;
}

type View = "table" | "waterfall";

// 轮询间隔 — tracker 上报间隔通常 30-60 秒，15 秒一次够实时又不浪费
const POLL_MS = 15_000;

export default function ListContainer({ posts: initialPosts, categoryMeta, fallbackGradient }: Props) {
  // 默认列表视图，不持久化
  const [view, setView] = useState<View>("table");
  const [posts, setPosts] = useState<HomePost[]>(initialPosts);
  const lastFetchRef = useRef(0);

  // 后台静默刷新 — 只更新变化的计数字段，保留对象引用避免瀑布流闪烁
  const refresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < POLL_MS * 0.8) return;
    lastFetchRef.current = now;
    try {
      const res = await fetch(`/api/posts?limit=30&_t=${now}`, { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; items?: HomePost[] };
      if (!data.ok || !Array.isArray(data.items)) return;

      setPosts((prev) => {
        // 按 id 建索引，O(n) 查找
        const incoming = new Map<string, HomePost>();
        for (const p of data.items!) incoming.set(p.id, p);

        // 先检查长度和顺序 — 如果大变（新帖置顶/数量变），直接整体替换
        if (prev.length !== data.items!.length) return data.items!;
        for (let i = 0; i < prev.length; i++) {
          if (prev[i].id !== data.items![i].id) return data.items!;
        }

        // 顺序和数量都没变 — 逐字段合并，保留未变对象的引用
        let changed = false;
        const next = prev.map((old) => {
          const fresh = incoming.get(old.id);
          if (!fresh) return old;
          const seed = Number(fresh.seed_count ?? 0);
          const leech = Number(fresh.leech_count ?? 0);
          const dl = Number(fresh.download_count ?? 0);
          const fav = Number(fresh.favorite_count ?? 0);
          if (
            seed === Number(old.seed_count ?? 0) &&
            leech === Number(old.leech_count ?? 0) &&
            dl === Number(old.download_count ?? 0) &&
            fav === Number(old.favorite_count ?? 0)
          ) {
            return old; // 引用不变 → React 跳过重渲
          }
          changed = true;
          return {
            ...old,
            seed_count: seed,
            leech_count: leech,
            download_count: dl,
            favorite_count: fav,
          };
        });

        return changed ? next : prev;
      });
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    // 挂载后等 3 秒再第一次刷新（让 SSR 首屏先出）
    const t1 = setTimeout(refresh, 3000);
    const t2 = setInterval(refresh, POLL_MS);
    // 页面可见性变化时立刻刷一次（用户从后台切回来）
    const onVis = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearTimeout(t1); clearInterval(t2); document.removeEventListener("visibilitychange", onVis); };
  }, [refresh]);

  return (
    <section>
      {/* 顶部工具栏 */}
      <div className="mb-3 flex items-center justify-end">
        {/* 视图切换 */}
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setView("waterfall")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition ${
              view === "waterfall"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
              <path d="M4 4h5v6H4zM11 4h5v10h-5zM4 12h5v4H4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            瀑布流
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition ${
              view === "table"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            列表
          </button>
        </div>
      </div>

      {view === "waterfall" ? (
        <PostsWaterfall posts={posts} categoryMeta={categoryMeta} fallbackGradient={fallbackGradient} />
      ) : (
        <PostsTable posts={posts} categoryMeta={categoryMeta} />
      )}
    </section>
  );
}
