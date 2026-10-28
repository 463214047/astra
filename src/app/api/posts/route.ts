/**
 * 帖子 API — 创建
 *
 * POST /api/posts
 * Body JSON:
 *   { title, subtitle?, category, content, tags[], cover_url?, screenshots[],
 *     anonymous:bool, rules_agreed:bool, torrent?:{name,size} }
 */

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { query, ensureSchema } from "@/lib/db";
import { parseTorrentTotalSize, parseTorrentInfoHash } from "@/lib/bencode";
import { validateExternalLinks, serializeExternalLinks } from "@/lib/external-links";

let schemaEnsured = false;
async function ensureOnce() {
  if (schemaEnsured) return;
  await ensureSchema();
  schemaEnsured = true;
}

const VALID_CATEGORIES = new Set(["游戏", "漫画", "动漫", "电影", "剧集"]);
const VALID_FORUM_TAGS = new Set(["求助", "邀请", "分享", "讨论", "公告"]);

export async function POST(req: Request) {
  try {
    await ensureOnce();

    const session = await auth();
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, message: "请求格式错误" }, { status: 400 });
    }

    const {
      title,
      subtitle,
      category,
      content,
      mediainfo,
      external_link,
      tags,
      cover_url,
      screenshots,
      anonymous,
      rules_agreed,
      is_adult,
      torrent,
      post_type,
    } = body as Record<string, unknown>;

    const isForum = post_type === "forum";

    // -------- 校验 --------
    if (!rules_agreed && !isForum) {
      return NextResponse.json({ ok: false, message: "请先同意上传规则" }, { status: 400 });
    }
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ ok: false, message: "标题不能为空" }, { status: 400 });
    }
    if (title.length > 120) {
      return NextResponse.json({ ok: false, message: "标题不能超过 120 字" }, { status: 400 });
    }
    if (subtitle != null && typeof subtitle !== "string") {
      return NextResponse.json({ ok: false, message: "副标题格式错误" }, { status: 400 });
    }
    if (subtitle && subtitle.length > 120) {
      return NextResponse.json({ ok: false, message: "副标题不能超过 120 字" }, { status: 400 });
    }
    if (!category || typeof category !== "string") {
      return NextResponse.json({ ok: false, message: "请选择有效的分类" }, { status: 400 });
    }
    if (isForum) {
      if (!VALID_FORUM_TAGS.has(category)) {
        return NextResponse.json({ ok: false, message: "请选择有效的论坛标签" }, { status: 400 });
      }
    } else {
      if (!VALID_CATEGORIES.has(category)) {
        return NextResponse.json({ ok: false, message: "请选择有效的分类" }, { status: 400 });
      }
    }
    // content（介绍）改为选填
    if (content != null && typeof content !== "string") {
      return NextResponse.json({ ok: false, message: "正文格式错误" }, { status: 400 });
    }
    if (content && content.trim().length > 20000) {
      return NextResponse.json({ ok: false, message: "正文不能超过 20000 字" }, { status: 400 });
    }
    // mediainfo 选填
    if (mediainfo != null && typeof mediainfo !== "string") {
      return NextResponse.json({ ok: false, message: "MediaInfo 格式错误" }, { status: 400 });
    }
    if (mediainfo && String(mediainfo).trim().length > 50000) {
      return NextResponse.json(
        { ok: false, message: "MediaInfo 过长（最多 50000 字）" },
        { status: 400 },
      );
    }

    // external_links：外部链接数组 {name, url}
    const extResult = validateExternalLinks(external_link);
    if (!extResult.ok) {
      return NextResponse.json({ ok: false, message: extResult.message }, { status: 400 });
    }
    const externalLinks = serializeExternalLinks(extResult.value);

    const tagArr = Array.isArray(tags)
      ? tags
          .filter((t) => typeof t === "string" && t.trim())
          .slice(0, 5)
          .map((t) => t.trim())
      : [];

    const cover = typeof cover_url === "string" && cover_url.trim() ? cover_url.trim() : null;

    const shotArr = Array.isArray(screenshots)
      ? screenshots
          .filter((s) => typeof s === "string" && s.trim())
          .slice(0, 5)
          .map((s) => s.trim())
      : [];

    const isAnonymous = Boolean(anonymous);
    const isAdult = Boolean(is_adult);

    const torrentName =
      torrent && typeof torrent === "object" && typeof (torrent as any).name === "string"
        ? (torrent as any).name
        : null;

    // 后端权威解析：前端传 torrent.data (base64) 时，后端自己用 bencode 算真实总大小
    let torrentSize: number | null =
      torrent && typeof torrent === "object" && typeof (torrent as any).size === "number"
        ? (torrent as any).size
        : null;

    const torrentData =
      torrent && typeof torrent === "object" && typeof (torrent as any).data === "string"
        ? (torrent as any).data
        : null;

    let torrentInfoHash: string | null = null;
    if (torrentData) {
      try {
        const buf = Buffer.from(torrentData, "base64");
        const u8 = new Uint8Array(buf);
        const total = parseTorrentTotalSize(u8);
        if (total !== null) torrentSize = Number(total);
        torrentInfoHash = parseTorrentInfoHash(u8);
      } catch {
        // 解析失败兜底
      }
    }

    // -------- 查作者名 --------
    const users = await query<{ name: string | null }>(
      `SELECT name FROM public.account_users WHERE email = $1`,
      [email],
    );
    // 匿名发布不存真实名字
    const authorName = isAnonymous ? null : (users[0]?.name ?? null);

    // -------- 插入 --------
    const rows = await query<{ id: string; created_at: string }>(
      `INSERT INTO public.posts
         (author_email, author_name, anonymous, post_type, category, title, subtitle, content, mediainfo, external_link,
          tags, cover_url, screenshot_urls, torrent_name, torrent_size, torrent_info_hash, torrent_data, is_adult)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING id, created_at`,
      [
        email,
        authorName,
        isAnonymous,
        isForum ? "forum" : "torrent",
        category,
        title.trim(),
        subtitle?.trim() ?? null,
        content ?? null,
        typeof mediainfo === "string" && mediainfo.trim() ? mediainfo.trim() : null,
        externalLinks,
        tagArr.length ? tagArr : null,
        cover,
        shotArr.length ? shotArr : null,
        torrentName,
        torrentSize,
        torrentInfoHash,
        torrentData,
        isAdult,
      ],
    );

    // torrent whitelist（PT tracker 用）
    if (torrentInfoHash) {
      // 种子验重 — 同一个 info_hash 只能属于一个帖子
      const dup = await query<{ post_id: string; uploaded_by: string }>(
        `SELECT post_id, uploaded_by FROM public.torrent_whitelist WHERE info_hash = $1`,
        [torrentInfoHash],
      );
      if (dup.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            message:
              dup[0].uploaded_by === email
                ? "这个种子你已经发布过了，不能重复上传"
                : "这个种子已被其他用户发布，不得重复上传",
          },
          { status: 409 },
        );
      }
      await query(
        `INSERT INTO public.torrent_whitelist (info_hash, post_id, uploaded_by)
         VALUES ($1, $2, $3)`,
        [torrentInfoHash, rows[0].id, email],
      );
    }

    const created = rows[0];
    if (!created) {
      return NextResponse.json({ ok: false, message: "发布失败" }, { status: 500 });
    }

    // 触发首页重渲 — 下次访问立即拿到新数据
    revalidatePath("/");

    return NextResponse.json({
      ok: true,
      id: created.id,
      created_at: created.created_at,
    });
  } catch (err) {
    console.error("[POST /api/posts] 发布失败:", err);
    return NextResponse.json({ ok: false, message: "服务器错误，请稍后再试" }, { status: 500 });
  }
}

/**
 * 帖子 API — 列表
 *
 * GET /api/posts?category=游戏&sort=latest|hot&limit=20&offset=0
 *     /api/posts?mine=1  → 我的发布（需登录，返回全部状态含隐藏）
 */
export async function GET(req: Request) {
  try {
    await ensureOnce();

    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const resourceType = url.searchParams.get("type");
    const mine = url.searchParams.get("mine") === "1";
    const sort = url.searchParams.get("sort") === "hot" ? "hot" : "latest";
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20", 10), 1), 100);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);

    let sessionEmail: string | null = null;
    if (mine) {
      const s = await auth();
      sessionEmail = s?.user?.email ?? null;
      if (!sessionEmail) {
        return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
      }
    }

    const where: string[] = [];
    const params: unknown[] = [];

    if (mine && sessionEmail) {
      // 我的发布 — 默认 torrent only；?type=forum 可看论坛帖
      where.push(`author_email = $${params.length + 1}`);
      params.push(sessionEmail);
      const postType = url.searchParams.get("type");
      if (postType === "forum") {
        where.push(`post_type = $${params.length + 1}`);
        params.push("forum");
      } else {
        where.push(`post_type = $${params.length + 1}`);
        params.push("torrent");
      }
    } else {
      where.push(`status = 'published'`);
      where.push(`post_type = 'torrent'`);
      if (resourceType === "torrent") {
        where.push(`torrent_name IS NOT NULL AND torrent_name <> ''`);
      } else if (resourceType === "other") {
        where.push(`(torrent_name IS NULL OR torrent_name = '')`);
      }
    }

    if (category) {
      where.push(`category = $${params.length + 1}`);
      params.push(category);
    }

    // 按 hot 置顶 → 再按 created_at DESC 或 like_count DESC
    const orderBy =
      sort === "hot" ? "hot DESC, like_count DESC, created_at DESC" : "hot DESC, created_at DESC";

    params.push(limit, offset);
    const rows = await query<any>(
      `SELECT id,
              post_type,
              category, title, subtitle,
              anonymous, status,
              CASE WHEN anonymous THEN NULL ELSE author_name END AS author_name,
              anonymous AS _anon,
              tags, cover_url, screenshot_urls,
              torrent_name, torrent_size,
              hot, view_count, like_count, favorite_count, comment_count,
              seed_count, leech_count, download_count,
              created_at
       FROM public.posts
       WHERE ${where.join(" AND ")}
       ORDER BY ${orderBy}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    // 匿名帖子：替换作者显示名，隐藏 email
    // pg 的 numeric/bigint 类型返回的是 string — 全部转成 number
    const list = rows.map((r: any) => ({
      id: r.id,
      post_type: r.post_type ?? "torrent",
      category: r.category,
      title: r.title,
      subtitle: r.subtitle,
      status: r.status,
      tags: r.tags,
      cover_url: r.cover_url,
      screenshot_urls: r.screenshot_urls,
      torrent_name: r.torrent_name ?? null,
      torrent_size: r.torrent_size != null ? Number(r.torrent_size) : null,
      hot: Boolean(r.hot),
      view_count: Number(r.view_count ?? 0),
      like_count: Number(r.like_count ?? 0),
      favorite_count: Number(r.favorite_count ?? 0),
      comment_count: Number(r.comment_count ?? 0),
      seed_count: Number(r.seed_count ?? 0),
      leech_count: Number(r.leech_count ?? 0),
      download_count: Number(r.download_count ?? 0),
      created_at: r.created_at,
      author_name: r.anonymous ? null : (r.author_name ?? null),
      author_email: r.author_email,
      anonymous: Boolean(r.anonymous),
    }));

    return NextResponse.json({ ok: true, items: list });
  } catch (err) {
    console.error("[GET /api/posts] 列表失败:", err);
    return NextResponse.json({ ok: false, message: "服务器错误" }, { status: 500 });
  }
}
