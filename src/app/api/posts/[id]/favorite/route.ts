/**
 * 收藏 / 取消收藏
 * POST   /api/posts/{id}/favorite  → 收藏
 * DELETE /api/posts/{id}/favorite  → 取消收藏
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

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await ensureOnce();

    const session = await auth();
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
    }

    // 帖子必须存在
    const exists = await query("SELECT 1 FROM public.posts WHERE id = $1", [id]);
    if (!exists.length) {
      return NextResponse.json({ ok: false, message: "帖子不存在" }, { status: 404 });
    }

    await query(
      `INSERT INTO public.post_favorites (user_email, post_id)
       VALUES ($1, $2)
       ON CONFLICT (user_email, post_id) DO NOTHING`,
      [email, id],
    );
    await query(
      `UPDATE public.posts SET favorite_count = (SELECT COUNT(*) FROM public.post_favorites WHERE post_id = $1) WHERE id = $1`,
      [id],
    );

    return NextResponse.json({ ok: true, favorited: true });
  } catch (err) {
    console.error("[POST favorite]", err);
    return NextResponse.json({ ok: false, message: "服务器错误" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await ensureOnce();

    const session = await auth();
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
    }

    await query(
      `DELETE FROM public.post_favorites WHERE user_email = $1 AND post_id = $2`,
      [email, id],
    );
    await query(
      `UPDATE public.posts SET favorite_count = (SELECT COUNT(*) FROM public.post_favorites WHERE post_id = $1) WHERE id = $1`,
      [id],
    );

    return NextResponse.json({ ok: true, favorited: false });
  } catch (err) {
    console.error("[DELETE favorite]", err);
    return NextResponse.json({ ok: false, message: "服务器错误" }, { status: 500 });
  }
}
