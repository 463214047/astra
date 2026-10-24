/**
 * TMDB 链接解析 — 客户端 / 服务端共用（纯函数，无任何外部依赖）
 */

export type TmdbMediaType = "movie" | "tv";

export interface TmdbRef {
  mediaType: TmdbMediaType;
  id: number;
}

/** 匹配 themoviedb.org/movie/123 或 /tv/123（可选协议、www、slug、查询串） */
const TMDB_URL_RE =
  /(?:https?:\/\/)?(?:www\.)?themoviedb\.org\/(movie|tv)\/(\d+)/i;

/** 依次在若干文本里找第一个 TMDB 链接（外链 JSON / 正文 HTML / 副标题都能直接传入） */
export function extractTmdbRef(
  ...texts: (string | null | undefined)[]
): TmdbRef | null {
  for (const text of texts) {
    if (!text) continue;
    const m = text.match(TMDB_URL_RE);
    if (m) {
      return {
        mediaType: m[1].toLowerCase() === "tv" ? "tv" : "movie",
        id: Number(m[2]),
      };
    }
  }
  return null;
}
