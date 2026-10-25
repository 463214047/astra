import Link from "next/link";
import { query, ensureSchema } from "@/lib/db";
import { isRainbowName } from "@/lib/rainbow";
import ForumList, { type ForumTopic } from "./ForumList";

export const metadata = { title: "论坛" };

// ---------- 类型 ----------
type TopicTag = "求助" | "邀请" | "分享" | "讨论" | "公告";

type Topic = {
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
  author_role: string | null;
  author_rainbow_enabled: boolean | null;
  author_rainbow_until: Date | string | null;
  rainbow: boolean;
};

// ---------- 配置 ----------
const TAG_TABS: { key: TopicTag | "all"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "求助", label: "求助" },
  { key: "分享", label: "分享" },
  { key: "邀请", label: "邀请" },
  { key: "讨论", label: "讨论" },
  { key: "公告", label: "公告" },
];

const VALID_FORUM_TAGS: TopicTag[] = ["求助", "邀请", "分享", "讨论", "公告"];

// ---------- 数据获取 ----------
let schemaEnsured = false;
async function fetchForumTopics(tag?: string): Promise<ForumTopic[]> {
  if (!schemaEnsured) {
    await ensureSchema();
    schemaEnsured = true;
  }
  try {
    const validTag = VALID_FORUM_TAGS.includes(tag as TopicTag) ? tag : undefined;
    const rows = await query<Topic>(
      `SELECT p.id, p.category, p.title, p.content,
              p.author_email, p.author_name, p.anonymous,
              u.avatar_url, u.uid AS author_uid,
              u.role AS author_role,
              u.rainbow_enabled AS author_rainbow_enabled,
              u.rainbow_until AS author_rainbow_until,
              p.comment_count, p.created_at,
              (SELECT MAX(c.created_at) FROM public.post_comments c WHERE c.post_id = p.id) AS last_reply_at
       FROM public.posts p
       LEFT JOIN public.account_users u ON u.email = p.author_email
       WHERE p.post_type = 'forum'
         AND p.status = 'published'
         ${validTag ? "AND p.category = $1" : ""}
       ORDER BY COALESCE((SELECT MAX(c.created_at) FROM public.post_comments c WHERE c.post_id = p.id), p.created_at) DESC
       LIMIT 50`,
      validTag ? [validTag] : [],
    );
    return rows.map((r) => ({
      ...r,
      rainbow:
        !r.anonymous &&
        isRainbowName({
          role: r.author_role,
          rainbow_enabled: r.author_rainbow_enabled,
          rainbow_until: r.author_rainbow_until,
        }),
    }));
  } catch {
    return [];
  }
}

// ---------- 页面 ----------
export default async function ForumPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;
  const activeTag = VALID_FORUM_TAGS.includes(tag as TopicTag) ? (tag as TopicTag) : "all";
  const topics = await fetchForumTopics(activeTag === "all" ? undefined : activeTag);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      {/* 头部 */}
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">论坛</h1>
          <p className="mt-1 text-sm text-slate-500">交流、提问、分享，和同好一起成长</p>
        </div>
        <Link
          href="/forum/new"
          className="shrink-0 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 active:scale-95"
        >
          发新帖
        </Link>
      </header>

      {/* Tag tabs */}
      <nav className="mb-5 flex flex-wrap gap-1.5">
        {TAG_TABS.map((t) => {
          const isActive = activeTag === t.key;
          const href = t.key === "all" ? "/forum" : `/forum?tag=${encodeURIComponent(t.key)}`;
          return (
            <Link
              key={t.key}
              href={href}
              className={`rounded-full px-3.5 py-1 text-sm font-medium transition ${
                isActive
                  ? "bg-brand-600 text-white shadow-sm shadow-brand-600/20"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {/* 帖子列表 */}
      <ForumList topics={topics} />
    </div>
  );
}
