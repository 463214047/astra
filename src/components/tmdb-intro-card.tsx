import { ArrowUpRight, Film } from "lucide-react";
import ExpandableText from "@/components/expandable-text";
import type { TmdbInfo } from "@/lib/tmdb";

/**
 * 作品介绍卡片 — 详情页 MediaInfo 上方
 * 数据来自帖子里的 TMDB 链接（见 @/lib/tmdb）
 */

/** 评分数格式化：12874 → "1.3 万" */
function formatVotes(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万`;
  return String(n);
}

export default function TmdbIntroCard({ info }: { info: TmdbInfo }) {
  const creditLabel = info.mediaType === "tv" ? "主创" : "导演";
  const hasMeta = info.credits.length > 0 || Boolean(info.duration) || info.genres.length > 0;

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] [[data-background=tohru]_&]:bg-transparent">
      {/* 标题栏 */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-slate-900 text-slate-50">
            <Film size={13} strokeWidth={1.5} />
          </span>
          <span className="text-sm font-semibold text-slate-800">作品介绍</span>
        </div>
        <a
          href={info.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-xs text-slate-500 transition-colors hover:text-slate-900"
        >
          TMDB
          <ArrowUpRight size={12} strokeWidth={1.5} />
        </a>
      </div>

      {/* 内容 */}
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:gap-6 sm:p-6">
        {info.posterUrl && (
          <a
            href={info.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 self-start"
            title="在 TMDB 查看"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={info.posterUrl}
              alt={info.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              data-no-translate
              className="h-[168px] w-[112px] rounded-xl border border-slate-200 object-cover transition hover:opacity-90"
            />
          </a>
        )}

        <div className="min-w-0 flex-1">
          {/* 标题 + 年份 + 评分 */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 data-no-translate className="text-lg font-bold leading-snug text-slate-900">
              {info.title}
            </h2>
            {info.year && <span className="text-sm text-slate-400">{info.year}</span>}
            {info.rating != null && (
              <>
                <span
                  className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/10"
                  title={`${info.voteCount} 人评分`}
                >
                  ★ {info.rating.toFixed(1)}
                </span>
                {info.voteCount > 0 && (
                  <span className="text-xs text-slate-400">
                    {formatVotes(info.voteCount)}人评分
                  </span>
                )}
              </>
            )}
          </div>
          {info.originalTitle && info.originalTitle !== info.title && (
            <p data-no-translate className="mt-0.5 text-[13px] text-slate-400">
              {info.originalTitle}
            </p>
          )}

          {/* 导演 / 时长 / 类型 */}
          {hasMeta && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-slate-500">
              {info.credits.length > 0 && (
                <span>
                  {creditLabel} <span data-no-translate>{info.credits.join("、")}</span>
                </span>
              )}
              {info.duration && <span>{info.duration}</span>}
              {info.genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* 简介（超过 4 行时截断 + 内联展开） */}
          {info.overview && <ExpandableText text={info.overview} className="mt-2.5" />}
        </div>
      </div>
    </div>
  );
}
