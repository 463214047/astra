/**
 * 帖子评论 API
 *
 * GET  /api/posts/:id/comments  — 获取评论列表（按时间倒序，最新在前）
 * POST /api/posts/:id/comments  — 发表评论（登录用户）
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query, ensureSchema, withTransaction } from "@/lib/db";
import { isRainbowName } from "@/lib/rainbow";

let schemaEnsured = false;
async function ensureOnce() {
  if (schemaEnsured) return;
  await ensureSchema();
  schemaEnsured = true;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureOnce();
    const { id } = await params;

    // 先确认帖子存在
    const posts = await query<{ id: string }>(
      `SELECT id FROM public.posts WHERE id = $1 AND status = 'published'`,
      [id],
    );
    if (posts.length === 0) {
      return NextResponse.json({ ok: false, message: "帖子不存在" }, { status: 404 });
    }

    const rows = await query<{
      id: string;
      post_id: string;
      author_email: string;
      author_name: string | null;
      author_avatar: string | null;
      anonymous: boolean;
      parent_id: string | null;
      reply_to_email: string | null;
      content: string;
      created_at: string;
      author_role: string | null;
      author_rainbow_enabled: boolean | null;
      author_rainbow_until: Date | string | null;
    }>(
      `SELECT c.id, c.post_id, c.author_email, c.author_name, c.author_avatar,
              c.anonymous, c.parent_id, c.reply_to_email, c.content, c.created_at,
              u.role AS author_role,
              u.rainbow_enabled AS author_rainbow_enabled,
              u.rainbow_until AS author_rainbow_until
         FROM public.post_comments c
         LEFT JOIN public.account_users u ON u.email = c.author_email
         WHERE c.post_id = $1
         ORDER BY c.created_at DESC, c.id DESC`,
      [id],
    );

    const comments = rows.map((c) => ({
      ...c,
      rainbow: !c.anonymous && isRainbowName({
        role: c.author_role,
        rainbow_enabled: c.author_rainbow_enabled,
        rainbow_until: c.author_rainbow_until,
      }),
    }));

    return NextResponse.json({ ok: true, comments });
  } catch (err) {
    console.error(`[GET /api/posts/:id/comments] 失败:`, err);
    return NextResponse.json(
      { ok: false, message: "服务器错误" },
      { status: 500 },
    );
  }
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
    const content = String(body.content ?? "").trim();
    const parentId = body.parent_id ?? null;
    const replyToEmail = body.reply_to_email ?? null;
    const anonymous = Boolean(body.anonymous);

    if (!content) {
      return NextResponse.json(
        { ok: false, message: "评论内容不能为空" },
        { status: 400 },
      );
    }

    // 确认帖子存在
    const posts = await query<{ id: string; author_name: string | null }>(
      `SELECT id, author_name FROM public.posts WHERE id = $1 AND status = 'published'`,
      [id],
    );
    if (posts.length === 0) {
      return NextResponse.json({ ok: false, message: "帖子不存在" }, { status: 404 });
    }

    // 获取用户资料
    const users = await query<{
      name: string | null;
      avatar_url: string | null;
      role: string;
      rainbow_enabled: boolean;
      rainbow_until: Date | string | null;
    }>(
      `SELECT name, avatar_url, role, rainbow_enabled, rainbow_until
         FROM public.account_users WHERE email = $1`,
      [session.user.email],
    );
    const user = users[0];

    const comment = await withTransaction(async (q) => {
      const rows = await q(
        `INSERT INTO public.post_comments
            (post_id, author_email, author_name, author_avatar, anonymous, parent_id, reply_to_email, content)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, post_id, author_email, author_name, author_avatar, anonymous, parent_id, reply_to_email, content, created_at`,
        [
          id,
          session.user.email,
          anonymous ? null : (user?.name ?? session.user.name ?? session.user.email.split("@")[0]),
          anonymous ? null : (user?.avatar_url ?? null),
          anonymous,
          parentId,
          replyToEmail,
          content,
        ],
      );

      // 更新帖子评论计数
      await q(
        `UPDATE public.posts SET comment_count = comment_count + 1, updated_at = NOW() WHERE id = $1`,
        [id],
      );

      return rows[0];
    });

    return NextResponse.json({
      ok: true,
      comment: {
        ...comment,
        rainbow: !anonymous && isRainbowName({
          role: user?.role,
          rainbow_enabled: user?.rainbow_enabled,
          rainbow_until: user?.rainbow_until,
        }),
      },
    });
  } catch (err) {
    console.error(`[POST /api/posts/:id/comments] 失败:`, err);
    return NextResponse.json(
      { ok: false, message: "服务器错误" },
      { status: 500 },
    );
  }
}
