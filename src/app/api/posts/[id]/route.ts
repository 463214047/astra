/**
 * 帖子 API — 单条查询 / 更新 / 删除
 *
 * GET    /api/posts/:id  — 公开获取单条帖子详情
 * PUT    /api/posts/:id  — 作者本人更新
 * DELETE /api/posts/:id  — 作者本人删除（CASCADE 清理评论/收藏/白名单）
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query, ensureSchema, withTransaction } from "@/lib/db";
import { parseTorrentTotalSize, parseTorrentInfoHash } from "@/lib/bencode";
import { validateExternalLinks, serializeExternalLinks } from "@/lib/external-links";

let schemaEnsured = false;
async function ensureOnce() {
  if (schemaEnsured) return;
  await ensureSchema();
  schemaEnsured = true;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureOnce();
    const { id } = await params;

    if (!id || typeof id !== "string" || id.length !== 36) {
      return NextResponse.json({ ok: false, message: "无效的帖子 ID" }, { status: 400 });
    }

    const rows = await query(
      `SELECT id, title, subtitle, content, mediainfo, external_link, category, tags, cover_url,
              screenshot_urls, torrent_name, torrent_size, anonymous, is_adult,
              view_count, comment_count, like_count, created_at, updated_at,
              author_email
       FROM public.posts WHERE id = $1`,
      [id],
    );

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, message: "帖子不存在" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item: rows[0] });
  } catch (err) {
    console.error(`[GET /api/posts/:id] 失败:`, err);
    return NextResponse.json({ ok: false, message: "服务器错误" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureOnce();
    const { id } = await params;

    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      title,
      subtitle,
      content,
      mediainfo,
      external_link,
      category,
      tags,
      cover_url,
      screenshots,
      torrent,
      anonymous,
      is_adult,
    } = body;

    // 权限：作者本人才能编辑
    const existing = await query<{ author_email: string }>(
      `SELECT author_email FROM public.posts WHERE id = $1`,
      [id],
    );
    if (existing.length === 0) {
      return NextResponse.json({ ok: false, message: "帖子不存在" }, { status: 404 });
    }
    if (existing[0].author_email !== session.user.email) {
      return NextResponse.json({ ok: false, message: "无权限" }, { status: 403 });
    }

    // 轻量校验
    if (title && (typeof title !== "string" || title.trim().length > 120)) {
      return NextResponse.json({ ok: false, message: "标题不合法" }, { status: 400 });
    }
    if (content && typeof content !== "string") {
      return NextResponse.json({ ok: false, message: "内容不合法" }, { status: 400 });
    }
    if (category && !["游戏", "漫画", "动漫", "电影", "剧集"].includes(category)) {
      return NextResponse.json({ ok: false, message: "分类不合法" }, { status: 400 });
    }

    // 只更新传入的字段（PATCH 语义）
    const updates: string[] = [];
    const values: unknown[] = [];

    function setIfPresent<T>(col: string, v: T | undefined | null, transform?: (v: T) => T) {
      if (v === undefined || v === null) return;
      updates.push(`${col} = $${updates.length + 1}`);
      values.push(transform ? transform(v as T) : v);
    }

    setIfPresent("title", title, (v) => (v as string).trim());
    setIfPresent("subtitle", subtitle ?? undefined, (v) => (v as string).trim());
    setIfPresent("content", content);
    setIfPresent("mediainfo", mediainfo, (v) => (v as string).trim() || null);

    // external_link：JSON 数组存 DB（空数组 = 清空，serialize 得到 null 也要写入）
    if (external_link !== undefined) {
      const extResult = validateExternalLinks(external_link);
      if (!extResult.ok) {
        return NextResponse.json({ ok: false, message: extResult.message }, { status: 400 });
      }
      updates.push(`external_link = $${updates.length + 1}`);
      values.push(serializeExternalLinks(extResult.value));
    }

    setIfPresent("category", category);
    setIfPresent("tags", tags);
    setIfPresent("cover_url", cover_url);
    setIfPresent("screenshot_urls", screenshots);
    setIfPresent("torrent_name", torrent?.name);

    // torrent_size：后端权威解析 base64 torrent 数据覆盖前端值
    let torrentSize: number | undefined = torrent?.size;
    let torrentInfoHash: string | null | undefined;
    let torrentDataUpdate: string | null | undefined;
    const torrentData = torrent?.data;
    if (typeof torrentData === "string" && torrentData.length > 0) {
      try {
        const buf = Buffer.from(torrentData, "base64");
        const u8 = new Uint8Array(buf);
        const total = parseTorrentTotalSize(u8);
        if (total !== null) torrentSize = Number(total);
        torrentInfoHash = parseTorrentInfoHash(u8);
        torrentDataUpdate = torrentData;
      } catch {
        /* 兜底 */
      }
    }

    // 种子验重 — 编辑帖子换种子时也不能跟别人撞 hash
    if (torrentInfoHash) {
      const dup = await query<{ post_id: string; uploaded_by: string }>(
        `SELECT post_id, uploaded_by FROM public.torrent_whitelist WHERE info_hash = $1`,
        [torrentInfoHash],
      );
      // 白名单里已经有这个 hash，且不是当前帖子自己
      if (dup.length > 0 && dup[0].post_id !== id) {
        return NextResponse.json(
          {
            ok: false,
            message:
              dup[0].uploaded_by === session.user.email
                ? "这个种子你已经发布到别的帖子了，不能重复使用"
                : "这个种子已被其他用户发布，不得重复上传",
          },
          { status: 409 },
        );
      }
    }

    setIfPresent("torrent_size", torrentSize);
    if (torrentInfoHash !== undefined) setIfPresent("torrent_info_hash", torrentInfoHash);
    if (torrentDataUpdate !== undefined) setIfPresent("torrent_data", torrentDataUpdate);
    setIfPresent("anonymous", anonymous);
    setIfPresent("is_adult", is_adult);

    if (updates.length === 0) {
      return NextResponse.json({ ok: false, message: "没有要更新的内容" }, { status: 400 });
    }

    // 强制更新 updated_at
    updates.push("updated_at = NOW()");

    values.push(id);
    const sql = `UPDATE public.posts SET ${updates.join(", ")} WHERE id = $${values.length}`;
    await withTransaction(async (q) => {
      await q(sql, values);
      // torrent whitelist（编辑帖子重新上传 torrent 时需要确保白名单）
      if (torrentInfoHash) {
        await q(
          `INSERT INTO public.torrent_whitelist (info_hash, post_id, uploaded_by)
           VALUES ($1, $2, $3) ON CONFLICT (info_hash) DO NOTHING`,
          [torrentInfoHash, id, session.user.email],
        );
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[PUT /api/posts/:id] 失败:`, err);
    return NextResponse.json({ ok: false, message: "服务器错误" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureOnce();
    const { id } = await params;

    const session = await auth();
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
    }

    const rows = await query("SELECT author_email FROM public.posts WHERE id = $1", [id]);
    if (!rows.length) {
      return NextResponse.json({ ok: false, message: "帖子不存在" }, { status: 404 });
    }
    if (rows[0].author_email !== email) {
      return NextResponse.json({ ok: false, message: "没有权限删除" }, { status: 403 });
    }

    await query("DELETE FROM public.posts WHERE id = $1", [id]);
    // FK ON DELETE CASCADE 自动清理：post_comments / post_favorites / torrent_whitelist / post_reports

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/posts/:id]", err);
    return NextResponse.json({ ok: false, message: "服务器错误" }, { status: 500 });
  }
}
