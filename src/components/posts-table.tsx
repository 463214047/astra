"use client";

import { useState, useMemo, memo } from "react";
import Link from "next/link";
import { ArrowUp, ChevronDown, ChevronUp, ChevronsUpDown, Clock, Database } from "lucide-react";
import type { HomePost } from "@/app/(protected)/page";
import PostTag from "./post-tag";

type SortKey = "created_at" | "torrent_size" | "seed_count";
type SortDir = "asc" | "desc";

interface Props {
  posts: HomePost[];
  categoryMeta: Record<string, { label: string; tagBg: string; tagText: string }>;
}

function formatSize(bytes: number | null): { value: string; unit: string } {
  if (bytes == null || bytes <= 0) return { value: "—", unit: "" };
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  const value = `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)}`;
  return { value, unit: units[i] };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}天前`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}个月前`;
  return `${Math.floor(mo / 12)}年前`;
}

function PostsTable({ posts, categoryMeta }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    const arr = [...posts];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "created_at":
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case "torrent_size":
          return dir * ((a.torrent_size ?? -1) - (b.torrent_size ?? -1));
        case "seed_count":
          return dir * (a.seed_count - b.seed_count);
      }
    });
    return arr;
  }, [posts, sortKey, sortDir]);

  const caret = (active: boolean) =>
    active ? (
      sortDir === "asc" ? (
        <ChevronUp size={12} strokeWidth={1.5} className="ml-1 text-slate-900" />
      ) : (
        <ChevronDown size={12} strokeWidth={1.5} className="ml-1 text-slate-900" />
      )
    ) : (
      <ChevronsUpDown size={12} strokeWidth={1.5} className="ml-1 text-slate-300" />
    );

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
        <p className="text-sm text-slate-400">暂无内容，成为第一个发布者吧 ✨</p>
      </div>
    );
  }

  // 4 列：标题 | 做种↑ | 大小 | 发布时间
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-auto" />
          <col className="hidden sm:table-column" style={{ width: "80px" }} />
          <col className="hidden sm:table-column" style={{ width: "80px" }} />
          <col className="hidden sm:table-column" style={{ width: "80px" }} />
        </colgroup>

        <thead>
          <tr className="hidden bg-slate-50/70 text-xs font-medium text-slate-500 sm:table-row">
            <th className="px-4 py-2.5 text-left">标题</th>
            <th className="px-2 py-2.5 text-center">
              <button
                type="button"
                title="做种数"
                onClick={() => toggleSort("seed_count")}
                className={`flex w-full items-center justify-center transition hover:text-slate-700 ${sortKey === "seed_count" ? "text-slate-900 font-semibold" : ""}`}
              >
                <ArrowUp size={14} strokeWidth={1.5} />
                {caret(sortKey === "seed_count")}
              </button>
            </th>
            <th className="px-2 py-2.5 text-center">
              <button
                type="button"
                title="种子大小"
                onClick={() => toggleSort("torrent_size")}
                className={`flex w-full items-center justify-center transition hover:text-slate-700 ${sortKey === "torrent_size" ? "text-slate-900 font-semibold" : ""}`}
              >
                <Database size={14} strokeWidth={1.5} />
                {caret(sortKey === "torrent_size")}
              </button>
            </th>
            <th className="px-2 py-2.5 text-center">
              <button
                type="button"
                title="发布时间"
                onClick={() => toggleSort("created_at")}
                className={`flex w-full items-center justify-center transition hover:text-slate-700 ${sortKey === "created_at" ? "text-slate-900 font-semibold" : ""}`}
              >
                <Clock size={14} strokeWidth={1.5} />
                {caret(sortKey === "created_at")}
              </button>
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {sorted.map((post) => {
            const meta = categoryMeta[post.category];
            const tags = post.tags ?? [];
            return (
              <tr key={post.id} className="group transition hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  <Link href={`/posts/${post.id}`} className="block min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        data-no-translate
                        className="truncate text-sm font-medium text-slate-800 group-hover:text-slate-900"
                      >
                        {post.title}
                      </span>
                      {post.hot && (
                        <span className="shrink-0 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                          🔥 HOT
                        </span>
                      )}
                    </div>
                    {(meta || post.subtitle || tags.length > 0) && (
                      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-slate-500">
                        {meta && (
                          <span
                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-medium ${meta.tagBg} ${meta.tagText}`}
                          >
                            {meta.label}
                          </span>
                        )}
                        {post.subtitle && (
                          <span data-no-translate className="truncate">
                            {post.subtitle}
                          </span>
                        )}
                        {tags.length > 0 && (
                          <span className="flex shrink-0 items-center gap-1">
                            {tags.map((t: string, i: number) => (
                              <PostTag key={i} tag={t} />
                            ))}
                          </span>
                        )}
                      </div>
                    )}
                    {/* 移动端 — 做种 / 大小 / 时间 */}
                    <div className="mt-1 flex items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 sm:hidden">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <span className="text-emerald-600">↑</span>
                        <span className="font-medium">{post.seed_count ?? 0}</span>
                      </span>
                      <span>
                        {(() => {
                          const s = formatSize(post.torrent_size);
                          return `${s.value}${s.unit ? " " + s.unit : ""}`;
                        })()}
                      </span>
                      <span>{timeAgo(post.created_at)}</span>
                    </div>
                  </Link>
                </td>
                <td className="hidden px-2 py-3 text-center sm:table-cell">
                  <span className="text-[13px] text-emerald-600 tabular-nums font-medium">
                    {post.seed_count ?? 0}
                  </span>
                </td>
                <td className="hidden px-2 py-3 text-center sm:table-cell">
                  {(() => {
                    const s = formatSize(post.torrent_size);
                    return (
                      <span className="text-[13px] tabular-nums">
                        <span className="text-slate-600">{s.value}</span>
                        {s.unit && <span className="ml-0.5 text-slate-400">{s.unit}</span>}
                      </span>
                    );
                  })()}
                </td>
                <td className="hidden px-2 py-3 text-center sm:table-cell">
                  <span className="text-[13px] text-slate-500">{timeAgo(post.created_at)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function postsShallowEqual(a: HomePost[], b: HomePost[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export default memo(
  PostsTable,
  (prev, next) =>
    postsShallowEqual(prev.posts, next.posts) && prev.categoryMeta === next.categoryMeta,
);
