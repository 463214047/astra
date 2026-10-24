/**
 * 我的收藏列表
 * GET /api/favorites?limit=20&offset=0
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query, ensureSchema } from "@/lib/db";

let schemaEnsured = false;
async function ensureOnce() {
  if (schemaEnsured) return;
  await ensureSchema();
  schemaEnsured = true;
}

export async function GET(req: Request) {
  try {
    await ensureOnce();

    const session = await auth();
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20", 10), 1), 100);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);

    const rows = await query<{
      id: string;
      category: string;
      title: string;
      subtitle: string | null;
      cover_url: string | null;
      torrent_name: string | null;
      torrent_size: number | null;
      seed_count: number;
      leech_count: number;
      like_count: number;
      favorite_count: number;
      comment_count: number;
      created_at: string;
      fav_created_at: string;
    }>(
      `SELECT p.id, p.category, p.title, p.subtitle, p.cover_url,
              p.torrent_name, p.torrent_size, p.seed_count, p.leech_count,
              p.like_count, p.favorite_count, p.comment_count, p.created_at,
              pf.created_at AS fav_created_at
       FROM public.post_favorites pf
       JOIN public.posts p ON p.id = pf.post_id
       WHERE pf.user_email = $1 AND p.status = 'published'
       ORDER BY pf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [email, limit, offset],
    );

    return NextResponse.json({ ok: true, items: rows });
  } catch (err) {
    console.error("[GET favorites]", err);
    return NextResponse.json({ ok: false, message: "服务器错误" }, { status: 500 });
  }
}
