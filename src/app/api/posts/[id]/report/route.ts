/**
 * 帖子举报 API
 *
 * POST /api/posts/:id/report
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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureOnce();
    const { id } = await params;

    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const reason = String(body.reason ?? "").trim();

    if (!reason) {
      return NextResponse.json(
        { ok: false, message: "请填写举报原因" },
        { status: 400 },
      );
    }
    if (reason.length > 500) {
      return NextResponse.json(
        { ok: false, message: "举报原因不超过 500 字" },
        { status: 400 },
      );
    }

    // 确认帖子存在
    const posts = await query<{ id: string }>(
      `SELECT id FROM public.posts WHERE id = $1 AND status = 'published'`,
      [id],
    );
    if (posts.length === 0) {
      return NextResponse.json({ ok: false, message: "帖子不存在" }, { status: 404 });
    }

    await query(
      `INSERT INTO public.post_reports (post_id, reporter_email, reason)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_id, reporter_email) DO NOTHING`,
      [id, session.user.email, reason],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[POST /api/posts/:id/report] 失败:`, err);
    return NextResponse.json(
      { ok: false, message: "服务器错误" },
      { status: 500 },
    );
  }
}
