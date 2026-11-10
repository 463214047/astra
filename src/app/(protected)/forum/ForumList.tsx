"use client";

import Link from "next/link";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { UserName } from "@/components/rainbow-name";

type TopicTag = "求助" | "邀请" | "分享" | "讨论" | "公告";

export type ForumTopic = {
  id: string;
  title: string;
  content: string | null;
  author_name: string | null;
  author_email: string;
  author_uid: number | null;
  avatar_url: string | null;
  anonymous: boolean;
  category: TopicTag;
  comment_count: number;
  created_at: string;
  last_reply_at: string | null;
  rainbow: boolean;
};

const TAG_STYLES: Record<TopicTag, string> = {
  求助: "bg-blue-50 text-blue-600 ring-blue-200",
  邀请: "bg-violet-50 text-violet-600 ring-violet-200",
  分享: "bg-emerald-50 text-emerald-600 ring-emerald-200",
  讨论: "bg-amber-50 text-amber-600 ring-amber-200",
  公告: "bg-rose-50 text-rose-600 ring-rose-200",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return d.toLocaleDateString("zh-CN");
}

export default function ForumList({ topics }: { topics: ForumTopic[] }) {
  const router = useRouter();

  if (topics.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
          <svg viewBox="0 0 24 24" fill="none" className="size-8">
            <path
              d="M4 5h16v12H7l-3 3V5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M8 10h8M8 13h5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className="text-base font-medium text-slate-700">还没有任何帖子</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {topics.map((t) => {
        const initial = t.anonymous ? "匿" : (t.author_name ?? t.author_email).slice(0, 1);
        const showAvatar = !t.anonymous && t.avatar_url;
        const displayName = t.anonymous ? "匿名用户" : (t.author_name ?? t.author_email);
        return (
          <li key={t.id}>
            {/* 外层 Link — 整张卡片 */}
            <Link
              href={`/forum/${t.id}`}
              className="group block rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md hover:shadow-slate-900/5 [[data-background=tohru]_&]:bg-transparent"
            >
              <div className="flex items-start gap-4">
                {/* 头像 */}
                <div className="shrink-0">
                  {showAvatar ? (
                    <NextImage
                      src={t.avatar_url!}
                      alt={displayName}
                      width={40}
                      height={40}
                      unoptimized
                      className="rounded-full ring-1 ring-slate-200"
                    />
                  ) : (
                    <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-sm font-semibold text-slate-600">
                      <span data-no-translate>{initial}</span>
                    </span>
                  )}
                </div>

                {/* 主体 */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TAG_STYLES[t.category]}`}
                    >
                      {t.category}
                    </span>
                    <h2
                      data-no-translate
                      className="truncate text-base font-semibold text-slate-900 transition group-hover:text-slate-700"
                    >
                      {t.title}
                    </h2>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
                    {/* 用户名 — button 避免嵌套 <a> */}
                    {!t.anonymous && t.author_uid ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(`/users/${t.author_uid}`);
                        }}
                        className="inline-flex items-center gap-1 font-medium text-slate-600 transition hover:text-brand-700"
                      >
                        <User size={14} className="shrink-0 opacity-70" />
                        <UserName name={displayName} rainbow={t.rainbow} />
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                        <User size={14} className="shrink-0 opacity-70" />
                        <UserName name={displayName} rainbow={t.rainbow} />
                      </span>
                    )}
                    <span className="text-slate-300">·</span>
                    <span>发布于 {formatTime(t.created_at)}</span>

                    {t.last_reply_at && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span>最新回复 {formatTime(t.last_reply_at)}</span>
                      </>
                    )}

                    <span className="ml-auto flex items-center gap-1.5 text-slate-500">
                      <svg viewBox="0 0 20 20" fill="none" className="size-5 text-slate-400">
                        <path
                          d="M3 5h14v8H5.5L3 15.5V5Z"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="tabular-nums text-sm font-medium text-slate-600">
                        {t.comment_count}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
