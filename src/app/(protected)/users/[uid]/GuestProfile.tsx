import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Scale, Star } from "lucide-react";
import { query } from "@/lib/db";
import { ProfileBanner, Stat, fmtInt, splitBytes } from "./page";
import type { UserRow, UserStats } from "./page";
import ProfileStats, { type StatMetric } from "./ProfileStats";

type PublicPost = {
  id: string;
  title: string;
  subtitle: string | null;
  category: string;
  cover_url: string | null;
  screenshot_urls: string[] | null;
  created_at: string;
  seed_count: number;
  leech_count: number;
  favorite_count: number;
  like_count: number;
  comment_count: number;
};

type ForumTopic = {
  id: string;
  title: string;
  category: string;
  comment_count: number;
  created_at: string;
};

export default async function GuestProfile({ user, stats }: { user: UserRow; stats: UserStats }) {
  const counts = await query<{ post_count: number; seed_count: number; fav_count: number; torrent_count: number; forum_count: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'published') AS post_count,
       COALESCE(SUM(seed_count) FILTER (WHERE status = 'published'), 0) AS seed_count,
       (SELECT COUNT(*) FROM public.post_favorites WHERE user_email = $1) AS fav_count,
       COUNT(*) FILTER (WHERE post_type = 'torrent' AND status = 'published') AS torrent_count,
       COUNT(*) FILTER (WHERE post_type = 'forum' AND status = 'published') AS forum_count
     FROM public.posts WHERE author_email = $1`,
    [user.email],
  );

  const posts = await query<PublicPost>(
    `SELECT id, title, subtitle, category, cover_url, screenshot_urls, created_at,
            COALESCE(seed_count, 0)  AS seed_count,
            COALESCE(leech_count, 0) AS leech_count,
            COALESCE(favorite_count, 0) AS favorite_count,
            COALESCE(like_count, 0)    AS like_count,
            COALESCE(comment_count, 0) AS comment_count
     FROM public.posts
     WHERE author_email = $1 AND status = 'published' AND post_type = 'torrent'
     ORDER BY created_at DESC
     LIMIT 30`,
    [user.email],
  );

  const forums = await query<ForumTopic>(
    `SELECT id, title, category, COALESCE(comment_count,0) AS comment_count, created_at
     FROM public.posts
     WHERE author_email = $1 AND post_type = 'forum' AND status = 'published'
     ORDER BY created_at DESC LIMIT 20`,
    [user.email],
  );

  const shareRatioText = stats.shareRatio >= 999 ? "∞" : stats.shareRatio.toFixed(2);
  const uploaded = splitBytes(stats.uploaded);
  const downloaded = splitBytes(stats.downloaded);

  const metrics: StatMetric[] = [
    { icon: Scale, label: "分享率", value: shareRatioText, unit: "", iconClass: "text-slate-400" },
    { icon: ArrowUpRight, label: "累计上传", value: uploaded.value, unit: uploaded.unit, iconClass: "text-emerald-500" },
    { icon: ArrowDownRight, label: "累计下载", value: downloaded.value, unit: downloaded.unit, iconClass: "text-sky-500" },
    { icon: Star, label: "做种积分", value: fmtInt(stats.seedPoints), unit: "", iconClass: "text-yellow-500" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 space-y-6">
      <ProfileBanner
        user={user}
        stats={
          <>
            <Stat label="发布" value={counts[0]?.post_count ?? 0} />
            <Stat label="收藏" value={counts[0]?.fav_count ?? 0} />
            <Stat label="做种" value={counts[0]?.seed_count ?? 0} tone="text-emerald-600" />
          </>
        }
      />

      {/* 公开数据指标（魔力为私有） */}
      <ProfileStats title="分享数据" subtitle="仅展示公开数据" metrics={metrics} />

      {/* 公开种子 */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 shadow-sm shadow-slate-900/[0.03]">
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-slate-900 px-2">
          发布的种子
          <span className="text-xs font-normal text-slate-400">· {posts.length}</span>
        </h2>

        {posts.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-400">该用户还没有公开的种子</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {posts.map((p) => (
              <li key={p.id} className="group flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                {(p.cover_url ?? p.screenshot_urls?.[0]) ? (
                  <Link href={`/posts/${p.id}`}
                    className="shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.cover_url ?? p.screenshot_urls![0]} alt=""
                      className="h-14 w-20 object-cover transition group-hover:scale-[1.03]" />
                  </Link>
                ) : (
                  <div className="shrink-0 grid h-14 w-20 place-items-center rounded-lg bg-slate-100 text-lg ring-1 ring-slate-200">📦</div>
                )}

                <div className="min-w-0 flex-1">
                  <Link href={`/posts/${p.id}`}
                    className="block truncate text-[14px] font-medium text-slate-900 hover:text-slate-700">
                    {p.title}
                  </Link>
                  {p.subtitle && (
                    <p className="mt-0.5 truncate text-[12px] text-slate-500">{p.subtitle}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{p.category}</span>
                    {p.seed_count > 0 && <span className="text-emerald-600">▲ {p.seed_count}</span>}
                    {p.leech_count > 0 && <span className="text-sky-600">▼ {p.leech_count}</span>}
                    {p.favorite_count > 0 && <span>⭐ {p.favorite_count}</span>}
                    {p.like_count > 0 && <span>♥ {p.like_count}</span>}
                    <span className="text-slate-400">{new Date(p.created_at).toLocaleDateString("zh-CN")}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 公开论坛帖子 */}
      {forums.length > 0 && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 shadow-sm shadow-slate-900/[0.03]">
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-slate-900 px-2">
            论坛帖子
            <span className="text-xs font-normal text-slate-400">· {forums.length}</span>
          </h2>
          <ul className="divide-y divide-slate-100">
            {forums.map((f) => (
              <li key={f.id} className="py-3 first:pt-0 last:pb-0">
                <Link href={`/forum/${f.id}`} className="group flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-slate-900 group-hover:text-violet-600">{f.title}</p>
                    <div className="mt-1 flex items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{f.category}</span>
                      {f.comment_count > 0 && <span className="text-slate-500">💬 {f.comment_count}</span>}
                      <span className="text-slate-400">{new Date(f.created_at).toLocaleDateString("zh-CN")}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
