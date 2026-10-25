"use client";

import { memo } from "react";
import Link from "next/link";
import type { HomePost } from "@/app/(protected)/page";
import PostTag from "./post-tag";

type CategoryMeta = { label: string; tagBg: string; tagText: string };

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

interface Props {
  posts: HomePost[];
  categoryMeta: Record<string, CategoryMeta>;
  fallbackGradient: Record<string, string>;
}

function PostsWaterfall({ posts, categoryMeta, fallbackGradient }: Props) {
  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
        <p className="text-sm text-slate-400">暂无内容，成为第一个发布者吧 ✨</p>
      </div>
    );
  }

  return (
    <div className="columns-2 gap-3 md:columns-3 lg:columns-4 [column-fill:_balance]">
      {posts.map((post) => {
        const meta = categoryMeta[post.category];
        const gradient = fallbackGradient[post.category] ?? "from-slate-400 to-slate-500";
        const cover = post.cover_url ?? post.screenshot_urls?.[0] ?? null;

        return (
          <Link
            key={post.id}
            href={`/posts/${post.id}`}
            className="mb-3 block break-inside-avoid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] transition hover:-translate-y-0.5 hover:shadow-md"
          >
            {/* 封面区 — 高度随内容变化，形成瀑布流 */}
            {cover ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cover} alt="" className="w-full object-cover" loading="lazy" />
                {post.hot && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
                    🔥 HOT
                  </span>
                )}
                {meta && (
                  <span
                    className={`absolute left-1.5 top-1.5 rounded-md px-2 py-0.5 text-[13px] font-semibold backdrop-blur ${meta.tagBg} ${meta.tagText}`}
                  >
                    {meta.label}
                  </span>
                )}
              </div>
            ) : (
              <div
                className={`grid aspect-video place-items-center bg-gradient-to-br text-2xl font-bold text-white drop-shadow ${gradient}`}
              >
                {meta?.label ?? "📦"}
              </div>
            )}

            {/* 信息区 */}
            <div className="p-2.5">
              <h3
                className="line-clamp-2 text-[14px] font-semibold leading-snug text-slate-900"
                title={post.title}
              >
                {post.title}
              </h3>
              {post.subtitle && (
                <p className="mt-0.5 line-clamp-1 text-[12px] text-slate-500" title={post.subtitle}>
                  {post.subtitle}
                </p>
              )}

              {/* 标签行（副标题下方，无标签不渲染） */}
              {post.tags && post.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {post.tags.map((t: string, i: number) => (
                    <PostTag key={i} tag={t} />
                  ))}
                </div>
              )}

              {/* 一行：左=做种  右=大小 + 时间 — 风格统一 */}
              <div className="mt-1 flex items-center justify-between gap-x-3 text-[12px]">
                <span className="inline-flex items-center gap-1 tabular-nums text-slate-600">
                  <span className="text-emerald-600">↑</span>
                  <span className="text-slate-700 font-medium">{post.seed_count ?? 0}</span>
                </span>
                <div className="flex items-center gap-x-2 text-slate-400">
                  {post.torrent_size != null &&
                    post.torrent_size > 0 &&
                    (() => {
                      const units = ["B", "KB", "MB", "GB", "TB"];
                      let i = 0;
                      let n = post.torrent_size;
                      while (n >= 1024 && i < units.length - 1) {
                        n /= 1024;
                        i++;
                      }
                      const value = `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)}`;
                      return (
                        <span className="tabular-nums text-[11px]">
                          <span className="text-slate-500">{value}</span>
                          <span className="ml-0.5 text-slate-400">{units[i]}</span>
                        </span>
                      );
                    })()}
                  <span className="text-[11px]">{timeAgo(post.created_at)}</span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function postsShallowEqual(a: HomePost[], b: HomePost[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export default memo(
  PostsWaterfall,
  (prev, next) =>
    postsShallowEqual(prev.posts, next.posts) &&
    prev.categoryMeta === next.categoryMeta &&
    prev.fallbackGradient === next.fallbackGradient,
);
