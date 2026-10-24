"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// 与首页 CATEGORY_META 保持一致
const CATEGORY_META: Record<string, { label: string; tagBg: string; tagText: string }> = {
  "游戏":   { label: "游戏",   tagBg: "bg-blue-600",   tagText: "text-white" },
  "漫画":   { label: "漫画",   tagBg: "bg-emerald-600",tagText: "text-white" },
  "动漫":   { label: "动漫",   tagBg: "bg-violet-600", tagText: "text-white" },
  "电影":   { label: "电影",   tagBg: "bg-amber-500",  tagText: "text-white" },
  "剧集": { label: "剧集", tagBg: "bg-rose-500",   tagText: "text-white" },
  "音乐":   { label: "音乐",   tagBg: "bg-cyan-600",   tagText: "text-white" },
  "体育":   { label: "体育",   tagBg: "bg-lime-600",   tagText: "text-white" },
  "综艺":   { label: "综艺",   tagBg: "bg-fuchsia-500",tagText: "text-white" },
};

type PostItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  category: string;
  cover_url?: string | null;
  torrent_name?: string | null;
  torrent_size?: number | null;
  seed_count?: number;
  leech_count?: number;
  download_count?: number;
  favorite_count?: number;
  like_count?: number;
  comment_count?: number;
  status?: string;
  created_at: string;
};

type TabKind = "torrents" | "forums" | "favorites";

export default function ProfileTabs() {
  const [tab, setTab] = useState<TabKind>("torrents");
  // 三个 tab 各自缓存数据，懒加载一次后不再重复 fetch
  const [cache, setCache] = useState<Record<TabKind, PostItem[] | null>>({
    torrents: null,
    forums: null,
    favorites: null,
  });
  const [loadingTab, setLoadingTab] = useState<TabKind | null>("torrents");

  async function fetchTab(t: TabKind) {
    // 已缓存就跳过
    if (cache[t] != null) return;
    setLoadingTab(t);
    try {
      let url: string;
      if (t === "torrents") url = "/api/posts?mine=1&type=torrent&limit=50";
      else if (t === "forums") url = "/api/posts?mine=1&type=forum&limit=50";
      else url = "/api/favorites?limit=50";

      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({ ok: false }));
      if (res.ok && data.ok) {
        setCache((prev) => ({ ...prev, [t]: data.items || [] }));
      } else {
        setCache((prev) => ({ ...prev, [t]: [] }));
      }
    } catch {
      setCache((prev) => ({ ...prev, [t]: [] }));
    } finally {
      setLoadingTab((cur) => (cur === t ? null : cur));
    }
  }

  useEffect(() => {
    fetchTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const items = cache[tab] ?? [];
  const loading = loadingTab === tab;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
      {/* Tab 头 */}
      <div className="flex border-b border-slate-200 px-5">
        <TabButton active={tab === "torrents"} onClick={() => setTab("torrents")}>
          我的发布
        </TabButton>
        <TabButton active={tab === "forums"} onClick={() => setTab("forums")}>
          我的帖子
        </TabButton>
        <TabButton active={tab === "favorites"} onClick={() => setTab("favorites")}>
          我的收藏
        </TabButton>
      </div>

      {/* 列表 */}
      <div className="p-3 sm:p-5">
        {loading ? (
          <Empty text="加载中…" />
        ) : items.length === 0 ? (
          <Empty
            text={
              tab === "torrents" ? "还没发布过种子"
              : tab === "forums" ? "还没发过论坛帖子"
              : "还没有收藏，帖子详情页点 ⭐ 收藏"
            }
            action={
              tab === "torrents" ? { label: "去发布", href: "/upload" }
              : tab === "forums" ? { label: "去论坛", href: "/forum" }
              : null
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((p) => (
              tab === "forums" ? (
                <ForumRow key={p.id} item={p} />
              ) : (
                <TorrentRow key={p.id} item={p} />
              )
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-5 py-3 text-sm font-medium transition ${
        active ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-slate-900" />
      )}
    </button>
  );
}

function Empty({ text, action }: { text: string; action?: { label: string; href: string } | null }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-slate-400">{text}</p>
      {action && (
        <Link href={action.href}
          className="mt-3 inline-block rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-700 active:scale-95">
          {action.label}
        </Link>
      )}
    </div>
  );
}

/** torrent 行 — 对齐首页列表 PostsTable：无封面、彩色分类 pill + 副标题 */
function TorrentRow({ item }: { item: PostItem }) {
  const meta = CATEGORY_META[item.category];

  return (
    <li className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        {/* 第一行：主标题 + 隐藏标记 */}
        <div className="flex items-center gap-2">
          <Link href={`/posts/${item.id}`}
            className="truncate text-sm font-medium text-slate-800 group-hover:text-slate-900">
            {item.title}
          </Link>
          {item.status === "hidden" && (
            <span className="shrink-0 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">隐藏</span>
          )}
        </div>
        {/* 第二行：彩色分类 pill + 副标题 */}
        {(meta || item.subtitle) && (
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-slate-500">
            {meta && (
              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-medium ${meta.tagBg} ${meta.tagText}`}>
                {meta.label}
              </span>
            )}
            {item.subtitle && (
              <span className="truncate">{item.subtitle}</span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** forum 行 — 💬 图标 + /forum/{id} */
function ForumRow({ item }: { item: PostItem }) {
  return (
    <li className="group flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div className="shrink-0 grid h-14 w-20 place-items-center rounded-lg bg-violet-50 text-2xl ring-1 ring-violet-100">
        💬
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/forum/${item.id}`}
            className="truncate text-[14px] font-medium text-slate-900 hover:text-violet-600">
            {item.title}
          </Link>
          {item.status === "hidden" && (
            <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600 ring-1 ring-rose-200">隐藏</span>
          )}
        </div>
        {item.subtitle && (
          <p className="mt-0.5 truncate text-[12px] text-slate-500">{item.subtitle}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{item.category}</span>
          {typeof item.comment_count === "number" && item.comment_count > 0 && <span>💬 {item.comment_count}</span>}
          {typeof item.like_count === "number" && item.like_count > 0 && <span>♥ {item.like_count}</span>}
          <span className="text-slate-400">{new Date(item.created_at).toLocaleDateString("zh-CN")}</span>
        </div>
      </div>
    </li>
  );
}
