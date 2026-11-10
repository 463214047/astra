import { query, ensureSchema } from "@/lib/db";
import { isRainbowName } from "@/lib/rainbow";
import { auth } from "@/auth";
import ListContainer from "@/components/list-container";
import ForumList, { type ForumTopic } from "@/app/(protected)/forum/ForumList";

export const metadata = { title: "搜索" };

const CATEGORY_META: Record<
  string,
  { label: string; tagBg: string; tagText: string; emoji: string }
> = {
  游戏: { label: "游戏", tagBg: "bg-blue-600", tagText: "text-white", emoji: "🎮" },
  漫画: { label: "漫画", tagBg: "bg-emerald-600", tagText: "text-white", emoji: "📚" },
  动漫: { label: "动漫", tagBg: "bg-violet-600", tagText: "text-white", emoji: "🎬" },
  电影: { label: "电影", tagBg: "bg-amber-500", tagText: "text-white", emoji: "🎥" },
  剧集: { label: "剧集", tagBg: "bg-rose-500", tagText: "text-white", emoji: "📺" },
  音乐: { label: "音乐", tagBg: "bg-cyan-600", tagText: "text-white", emoji: "🎵" },
  体育: { label: "体育", tagBg: "bg-lime-600", tagText: "text-white", emoji: "⚽" },
  综艺: { label: "综艺", tagBg: "bg-fuchsia-500", tagText: "text-white", emoji: "🎤" },
};

const FALLBACK_GRADIENT: Record<string, string> = {
  游戏: "from-sky-400 to-indigo-500",
  漫画: "from-emerald-400 to-teal-500",
  动漫: "from-violet-400 to-fuchsia-500",
  电影: "from-rose-400 to-orange-400",
  剧集: "from-amber-400 to-yellow-600",
  音乐: "from-cyan-400 to-blue-500",
  体育: "from-lime-400 to-green-500",
  综艺: "from-fuchsia-400 to-pink-500",
};

// HomePost 字段（来自 list-container 的 import，这里用结构化 duck typing 避免循环依赖）
type SearchTorrent = {
  id: string;
  category: string;
  title: string;
  subtitle: string | null;
  tags: string[] | null;
  cover_url: string | null;
  screenshot_urls: string[] | null;
  torrent_name: string | null;
  torrent_size: number | null;
  seed_count: number;
  leech_count: number;
  favorite_count: number;
  download_count: number;
  hot: boolean;
  created_at: string;
  author_name: string | null;
  author_email: string;
  anonymous: boolean;
};

type SearchForumHit = {
  id: string;
  title: string;
  category: string;
  content: string | null;
  comment_count: number;
  author_name: string | null;
  author_email: string;
  author_uid: number | null;
  avatar_url: string | null;
  anonymous: boolean;
  created_at: string;
  last_reply_at: string | null;
  author_role: string | null;
  author_rainbow_enabled: boolean | null;
  author_rainbow_until: Date | string | null;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    scope?: string;
    category?: string;
    content?: string;
    seeded?: string;
    adult?: string;
    tags?: string;
  }>;
}) {
  const { q, scope, category, content, seeded, adult, tags } = await searchParams;
  const term = q?.trim();

  const session = await auth();
  const userEmail = session?.user?.email;

  const validScope = scope && ["mine", "seeded", "favorites"].includes(scope) ? scope : null;
  const validContent = ["torrent", "forum"].includes(content ?? "")
    ? (content as "torrent" | "forum")
    : "torrent";
  const validSeeded = seeded === "1";
  const validAdult = adult === "1";
  const validTags =
    tags
      ?.split(",")
      .map((t) => t.trim())
      .filter(Boolean) ?? [];

  // 空查询且无任何筛选 → 直接返回空态，不查库
  const anyFilter =
    !!term ||
    !!validScope ||
    !!category ||
    validTags.length > 0 ||
    validContent !== "torrent" ||
    validSeeded ||
    validAdult;
  if (!anyFilter) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-center text-sm text-slate-500">输入关键词或设置筛选条件后开始搜索</p>
      </div>
    );
  }

  await ensureSchema();

  // ---------- 种子查询 ----------
  const torrentWhere: string[] = [`p.status = 'published'`, `p.post_type = 'torrent'`];
  const torrentParams: (string | number)[] = [];

  if (term) {
    const like = `%${term.replace(/[!_%]/g, "\\$&")}%`;
    torrentWhere.push(
      `(p.title ILIKE $${torrentParams.length + 1} OR p.subtitle ILIKE $${torrentParams.length + 1} OR p.content ILIKE $${torrentParams.length + 1} OR p.torrent_name ILIKE $${torrentParams.length + 1} OR p.category ILIKE $${torrentParams.length + 1})`,
    );
    torrentParams.push(like);
  }
  if (category) {
    torrentWhere.push(`p.category = $${torrentParams.length + 1}`);
    torrentParams.push(category);
  }
  if (validTags.length) {
    torrentWhere.push(
      `p.tags && ARRAY[${validTags.map((_, i) => `$${torrentParams.length + i + 1}`).join(", ")}]::TEXT[]`,
    );
    torrentParams.push(...validTags);
  }
  if (validSeeded) torrentWhere.push(`p.seed_count > 0`);
  if (!validAdult) torrentWhere.push(`p.is_adult = FALSE`);
  if (validScope === "mine" && userEmail) {
    torrentWhere.push(`p.author_email = $${torrentParams.length + 1}`);
    torrentParams.push(userEmail);
  } else if (validScope === "seeded" && userEmail) {
    torrentWhere.push(`p.author_email = $${torrentParams.length + 1} AND p.seed_count > 0`);
    torrentParams.push(userEmail);
  } else if (validScope === "favorites" && userEmail) {
    torrentWhere.push(
      `p.id IN (SELECT post_id FROM public.post_favorites WHERE user_email = $${torrentParams.length + 1})`,
    );
    torrentParams.push(userEmail);
  }

  // ---------- 论坛查询 ----------
  const forumWhere: string[] = [`p.status = 'published'`, `p.post_type = 'forum'`];
  const forumParams: (string | number)[] = [];

  if (term) {
    const like = `%${term.replace(/[!_%]/g, "\\$&")}%`;
    forumWhere.push(
      `(p.title ILIKE $${forumParams.length + 1} OR p.content ILIKE $${forumParams.length + 1} OR p.category ILIKE $${forumParams.length + 1})`,
    );
    forumParams.push(like);
  }
  if (category) {
    forumWhere.push(`p.category = $${forumParams.length + 1}`);
    forumParams.push(category);
  }
  if (!validAdult) forumWhere.push(`p.is_adult = FALSE`);
  if (validScope === "mine" && userEmail) {
    forumWhere.push(`p.author_email = $${forumParams.length + 1}`);
    forumParams.push(userEmail);
  } else if (validScope === "favorites" && userEmail) {
    forumWhere.push(
      `p.id IN (SELECT post_id FROM public.post_favorites WHERE user_email = $${forumParams.length + 1})`,
    );
    forumParams.push(userEmail);
  }

  const doTorrent = validContent === "torrent";
  const doForum = validContent === "forum";

  const [torrentRows, forumRows] = await Promise.all([
    doTorrent
      ? query<SearchTorrent>(
          `SELECT p.id, p.category, p.title, p.subtitle, p.tags, p.cover_url, p.screenshot_urls,
              p.torrent_name, p.torrent_size,
              p.seed_count, p.leech_count, p.favorite_count, p.download_count,
              p.hot, p.created_at, p.anonymous,
              CASE WHEN p.anonymous THEN NULL ELSE p.author_name END AS author_name,
              p.author_email
       FROM public.posts p
       WHERE ${torrentWhere.join(" AND ")}
       ORDER BY p.hot DESC, p.created_at DESC
       LIMIT 30`,
          torrentParams,
        ).then((rows) =>
          rows.map((r) => ({
            ...r,
            anonymous: Boolean(r.anonymous),
            hot: Boolean(r.hot),
            torrent_size: r.torrent_size != null ? Number(r.torrent_size) : null,
            seed_count: Number(r.seed_count ?? 0),
            leech_count: Number(r.leech_count ?? 0),
            favorite_count: Number(r.favorite_count ?? 0),
            download_count: Number(r.download_count ?? 0),
          })),
        )
      : Promise.resolve([] as SearchTorrent[]),

    doForum
      ? query<SearchForumHit>(
          `SELECT p.id, p.category, p.title, p.content,
              (SELECT COUNT(*) FROM public.post_comments c WHERE c.post_id = p.id) AS comment_count,
              (SELECT MAX(c.created_at) FROM public.post_comments c WHERE c.post_id = p.id) AS last_reply_at,
              p.anonymous,
              CASE WHEN p.anonymous THEN NULL ELSE p.author_name END AS author_name,
              p.author_email,
              u.uid AS author_uid, u.avatar_url,
              u.role AS author_role,
              u.rainbow_enabled AS author_rainbow_enabled,
              u.rainbow_until AS author_rainbow_until,
              p.created_at
       FROM public.posts p
       LEFT JOIN public.account_users u ON u.email = p.author_email
       WHERE ${forumWhere.join(" AND ")}
       ORDER BY p.created_at DESC
       LIMIT 30`,
          forumParams,
        )
      : Promise.resolve([] as SearchForumHit[]),
  ]);

  // ForumHit → ForumTopic (ForumList 需要的类型)
  const forumTopics: ForumTopic[] = forumRows.map((f) => ({
    id: f.id,
    title: f.title,
    content: f.content,
    author_name: f.author_name,
    author_email: f.author_email,
    author_uid: f.author_uid,
    avatar_url: f.avatar_url,
    anonymous: f.anonymous,
    category: f.category as ForumTopic["category"],
    comment_count: f.comment_count,
    created_at: f.created_at,
    last_reply_at: f.last_reply_at,
    rainbow:
      !f.anonymous &&
      isRainbowName({
        role: f.author_role,
        rainbow_enabled: f.author_rainbow_enabled,
        rainbow_until: f.author_rainbow_until,
      }),
  }));

  const total = torrentRows.length + forumTopics.length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      {total === 0 ? (
        <p className="text-center text-sm text-slate-500">没有找到匹配的结果</p>
      ) : (
        <>
          {doTorrent && torrentRows.length > 0 && (
            <ListContainer
              posts={torrentRows as any}
              categoryMeta={CATEGORY_META}
              fallbackGradient={FALLBACK_GRADIENT}
            />
          )}
          {doForum && forumTopics.length > 0 && <ForumList topics={forumTopics} />}
        </>
      )}
    </div>
  );
}
