import { query, ensureSchema } from "@/lib/db";
import ListContainer from "@/components/list-container";

export const metadata = {
  title: "种子资源",
};

// 强制动态渲染：做种/下载数来自 tracker announce 实时写入，不能缓存
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const CATEGORY_META: Record<string, { label: string; tagBg: string; tagText: string }> = {
  游戏: { label: "游戏", tagBg: "bg-blue-600", tagText: "text-white" },
  漫画: { label: "漫画", tagBg: "bg-emerald-600", tagText: "text-white" },
  动漫: { label: "动漫", tagBg: "bg-violet-600", tagText: "text-white" },
  电影: { label: "电影", tagBg: "bg-amber-500", tagText: "text-white" },
  剧集: { label: "剧集", tagBg: "bg-rose-500", tagText: "text-white" },
  音乐: { label: "音乐", tagBg: "bg-cyan-600", tagText: "text-white" },
  体育: { label: "体育", tagBg: "bg-lime-600", tagText: "text-white" },
  综艺: { label: "综艺", tagBg: "bg-fuchsia-500", tagText: "text-white" },
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

export type TorrentPost = {
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

let schemaEnsured = false;
async function fetchPosts(): Promise<TorrentPost[]> {
  if (!schemaEnsured) {
    await ensureSchema();
    schemaEnsured = true;
  }
  try {
    const rows = await query<TorrentPost>(
      `SELECT p.id, p.category, p.title, p.subtitle,
              p.tags, p.cover_url, p.screenshot_urls,
              p.author_email, p.anonymous,
              CASE WHEN p.anonymous THEN NULL ELSE p.author_name END AS author_name,
              p.torrent_name, p.torrent_size,
              p.seed_count, p.leech_count, p.favorite_count, p.download_count,
              p.hot, p.created_at
       FROM public.posts p
       WHERE p.status = 'published'
         AND p.post_type = 'torrent'
       ORDER BY p.hot DESC, p.created_at DESC
       LIMIT 30`,
    );
    // pg 的 numeric/bigint 类型返回的是 string — 统一转 number
    return rows.map((r) => ({
      ...r,
      anonymous: Boolean(r.anonymous),
      hot: Boolean(r.hot),
      torrent_size: r.torrent_size != null ? Number(r.torrent_size) : null,
      seed_count: Number(r.seed_count ?? 0),
      leech_count: Number(r.leech_count ?? 0),
      favorite_count: Number(r.favorite_count ?? 0),
      download_count: Number(r.download_count ?? 0),
    }));
  } catch {
    return [];
  }
}

export default async function TorrentsPage() {
  const posts = await fetchPosts();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <ListContainer
        posts={posts}
        categoryMeta={CATEGORY_META}
        fallbackGradient={FALLBACK_GRADIENT}
      />
    </div>
  );
}
