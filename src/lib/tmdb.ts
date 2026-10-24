/**
 * TMDB 元数据 — 拉取作品介绍（服务端；链接解析见 @/lib/tmdb-link）
 *
 * 环境变量:
 *   TMDB_API_KEY  必填（免费申请: https://www.themoviedb.org/settings/api）
 *   TMDB_API_BASE 可选，覆盖 API 地址（默认 https://api.themoviedb.org/3）
 *
 * 缓存: 持久化到数据库表 tmdb_cache，按「影视」维度（movie/tv + id）存，
 *       引用同一部作品的任何帖子直接复用（不再请求 TMDB）；
 *       有效期 7 天，过期后择机刷新，刷新失败回退旧数据（卡片不凭空消失）。
 *
 * 未配置 key / 解析不到链接 / 无缓存且拉取失败 → 一律静默返回 null（详情页不展示卡片）
 */

import { query, ensureSchema } from "@/lib/db";
import type { TmdbRef } from "@/lib/tmdb-link";

export { extractTmdbRef } from "@/lib/tmdb-link";
export type { TmdbMediaType, TmdbRef } from "@/lib/tmdb-link";

export interface TmdbInfo extends TmdbRef {
  title: string;
  originalTitle: string;
  year: string | null;
  rating: number | null;
  voteCount: number;
  genres: string[];
  /** 已格式化的体量文案：电影 "167 分钟"，剧集 "5 季 · 62 集" */
  duration: string | null;
  overview: string | null;
  posterUrl: string | null;
  /** 导演（电影）/ 主创（剧集），最多 2 位 */
  credits: string[];
  /** 规范化后的 TMDB 页面链接 */
  url: string;
}

/** TMDB API 返回体里用到的字段（宽松类型，按需解析） */
interface TmdbApiResponse {
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  genres?: { name?: string }[];
  vote_average?: number;
  vote_count?: number;
  overview?: string;
  poster_path?: string | null;
  created_by?: { name?: string }[];
  credits?: { crew?: { job?: string; name?: string }[] };
}

/** 本地缓存有效期（毫秒）；过期后尝试刷新，刷新失败仍回退旧数据 */
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

let schemaEnsured = false;
async function ensureOnce() {
  if (schemaEnsured) return;
  await ensureSchema();
  schemaEnsured = true;
}

/** 读本地缓存；未命中 / 读库失败返回 null */
async function readCache(
  ref: TmdbRef,
): Promise<{ data: TmdbInfo; fresh: boolean } | null> {
  try {
    await ensureOnce();
    const rows = await query<{ data: TmdbInfo; fetched_at: Date | string }>(
      `SELECT data, fetched_at FROM public.tmdb_cache
       WHERE media_type = $1 AND tmdb_id = $2`,
      [ref.mediaType, ref.id],
    );
    const row = rows[0];
    if (!row) return null;
    const age = Date.now() - new Date(row.fetched_at).getTime();
    return { data: row.data, fresh: age < CACHE_TTL };
  } catch (err) {
    console.warn("[TMDB] 读本地缓存失败:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** 写本地缓存（UPSERT；失败不打断页面） */
async function writeCache(info: TmdbInfo): Promise<void> {
  try {
    await ensureOnce();
    await query(
      `INSERT INTO public.tmdb_cache (media_type, tmdb_id, data)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (media_type, tmdb_id)
       DO UPDATE SET data = EXCLUDED.data, fetched_at = NOW()`,
      [info.mediaType, info.id, JSON.stringify(info)],
    );
  } catch (err) {
    console.warn("[TMDB] 写本地缓存失败:", err instanceof Error ? err.message : err);
  }
}

function toTmdbInfo(ref: TmdbRef, d: TmdbApiResponse): TmdbInfo {
  const isTv = ref.mediaType === "tv";

  const title =
    (isTv ? d.name : d.title) ||
    d.original_title ||
    d.original_name ||
    `TMDB #${ref.id}`;
  const originalTitle = (isTv ? d.original_name : d.original_title) || title;

  const date = isTv ? d.first_air_date : d.release_date;
  const year = date ? date.slice(0, 4) : null;

  const voteCount = d.vote_count ?? 0;
  const rating =
    d.vote_average && d.vote_average > 0 && voteCount > 0
      ? d.vote_average
      : null;

  let duration: string | null = null;
  if (isTv) {
    const parts: string[] = [];
    if (d.number_of_seasons) parts.push(`${d.number_of_seasons} 季`);
    if (d.number_of_episodes) parts.push(`${d.number_of_episodes} 集`);
    if (parts.length === 0 && d.episode_run_time?.[0]) {
      parts.push(`${d.episode_run_time[0]} 分钟/集`);
    }
    duration = parts.join(" · ") || null;
  } else if (d.runtime) {
    duration = `${d.runtime} 分钟`;
  }

  const credits = isTv
    ? (d.created_by ?? []).map((c) => c.name ?? "")
    : (d.credits?.crew ?? [])
        .filter((c) => c.job === "Director")
        .map((c) => c.name ?? "");

  return {
    ...ref,
    title: title.trim(),
    originalTitle: originalTitle.trim(),
    year,
    rating,
    voteCount,
    genres: (d.genres ?? []).map((g) => g.name ?? "").filter(Boolean),
    duration,
    overview: d.overview?.trim() || null,
    posterUrl: d.poster_path
      ? `https://image.tmdb.org/t/p/w342${d.poster_path}`
      : null,
    credits: [...new Set(credits)].filter(Boolean).slice(0, 2),
    url: `https://www.themoviedb.org/${ref.mediaType}/${ref.id}`,
  };
}

/** 请求 TMDB API（无 key / 失败返回 null，不写缓存） */
async function fetchFromTmdb(ref: TmdbRef): Promise<TmdbInfo | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  const base = (process.env.TMDB_API_BASE || "https://api.themoviedb.org/3").replace(/\/+$/, "");
  const params = new URLSearchParams({ api_key: apiKey, language: "zh-CN" });
  if (ref.mediaType === "movie") params.set("append_to_response", "credits");

  try {
    const res = await fetch(
      `${base}/${ref.mediaType}/${ref.id}?${params.toString()}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) {
      console.warn(`[TMDB] 拉取 ${ref.mediaType}/${ref.id} 失败: HTTP ${res.status}`);
      return null;
    }
    return toTmdbInfo(ref, (await res.json()) as TmdbApiResponse);
  } catch (err) {
    console.warn(
      `[TMDB] 拉取 ${ref.mediaType}/${ref.id} 异常:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * 拉取 TMDB 作品信息（优先本地库缓存，多帖子复用同一部作品的数据）
 * 无 key / 拉取失败且无缓存 → null（详情页不展示卡片）
 */
export async function fetchTmdbInfo(ref: TmdbRef): Promise<TmdbInfo | null> {
  const cached = await readCache(ref);
  if (cached?.fresh) return cached.data;

  const info = await fetchFromTmdb(ref);
  if (info) {
    await writeCache(info);
    return info;
  }
  // 刷新失败 → 用旧缓存兜底
  return cached?.data ?? null;
}
