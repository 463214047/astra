/**
 * 通知 API — 列表
 *
 * GET /api/notifications?type=system|reply|all  → 当前用户的通知列表（按时间倒序）
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
    if (!email) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

    const url = new URL(req.url);
    const type = url.searchParams.get("type"); // 'system' | 'reply' | null(全部)

    let sql = `SELECT id, type, title, content, source_type, source_id, source_title,
                      reply_author, reply_avatar, is_read, created_at
               FROM public.notifications WHERE recipient_email = $1`;
    const params: unknown[] = [email];

    if (type === "system" || type === "reply") {
      sql += ` AND type = $2`;
      params.push(type);
    }

    sql += ` ORDER BY created_at DESC LIMIT 200`;

    const rows = await query<any>(sql, params);

    // 同时返回各分类的未读数（前端 Tab 徽标用）
    const counts = await query<{ type: string; unread: string }>(
      `SELECT type, COUNT(*)::text AS unread
         FROM public.notifications
         WHERE recipient_email = $1 AND is_read = FALSE
         GROUP BY type`,
      [email],
    );

    const unreadByType: Record<string, number> = {};
    for (const c of counts) unreadByType[c.type] = parseInt(c.unread, 10);
    const totalUnread = Object.values(unreadByType).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      ok: true,
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        content: r.content,
        source_type: r.source_type,
        source_id: r.source_id,
        source_title: r.source_title,
        reply_author: r.reply_author,
        reply_avatar: r.reply_avatar,
        is_read: r.is_read,
        created_at: r.created_at,
      })),
      unread: {
        total: totalUnread,
        system: unreadByType.system ?? 0,
        reply: unreadByType.reply ?? 0,
      },
    });
  } catch (err) {
    console.error("[notifications GET]", err);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}
