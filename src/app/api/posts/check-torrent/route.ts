/**
 * 种子验重预检 — 前端选完 .torrent 后调，比正式提交早一步拿到 409 错误
 * POST /api/posts/check-torrent
 * Body: { torrent_base64?: string, torrent_info_hash?: string, exclude_post_id?: string }
 * 返回: { ok: true, available: true } 或 { ok: true, available: false, message: "..." }
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query, ensureSchema } from "@/lib/db";
import { parseTorrentInfoHash } from "@/lib/bencode";

let schemaEnsured = false;
async function ensureOnce() {
  if (schemaEnsured) return;
  await ensureSchema();
  schemaEnsured = true;
}

export async function POST(req: Request) {
  try {
    await ensureOnce();

    const session = await auth();
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, message: "请求格式错误" }, { status: 400 });
    }

    let infoHash: string | null = null;
    if (typeof body.torrent_info_hash === "string" && body.torrent_info_hash.length === 40) {
      infoHash = body.torrent_info_hash;
    } else if (typeof body.torrent_base64 === "string" && body.torrent_base64.length > 0) {
      try {
        const buf = Buffer.from(body.torrent_base64, "base64");
        infoHash = parseTorrentInfoHash(buf);
      } catch {
        // 解析失败，忽略
      }
    }

    if (!infoHash) {
      return NextResponse.json({ ok: false, available: false, message: "种子文件解析失败" });
    }

    const excludeId = typeof body.exclude_post_id === "string" ? body.exclude_post_id : null;

    const dup = await query<{ post_id: string; uploaded_by: string }>(
      `SELECT post_id, uploaded_by FROM public.torrent_whitelist WHERE info_hash = $1`,
      [infoHash],
    );

    if (dup.length === 0) {
      return NextResponse.json({ ok: true, available: true });
    }

    // 已存在 — 如果是编辑模式且命中的就是当前帖子自己 → 允许
    if (excludeId && dup[0].post_id === excludeId) {
      return NextResponse.json({ ok: true, available: true });
    }

    return NextResponse.json({
      ok: true,
      available: false,
      message:
        dup[0].uploaded_by === email
          ? "这个种子你已经发布过了，不能重复使用"
          : "这个种子已被其他用户发布，不得重复上传",
    });
  } catch (err) {
    console.error("[check-torrent]", err);
    return NextResponse.json({ ok: false, available: false, message: "校验失败" });
  }
}
