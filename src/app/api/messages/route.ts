/**
 * 消息 API — 发送消息 + 对话列表
 *
 * POST /api/messages        → 发送一条消息（自动创建/复用对话）
 * GET  /api/messages        → 当前用户的对话列表（含未读数 + 最后消息）
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

/** 确保 a / b 邮箱按字典序存入 conversations 表（唯一约束友好） */
function sorted(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** 发送消息 */
export async function POST(req: Request) {
  try {
    await ensureOnce();
    const session = await auth();
    const sender = session?.user?.email;
    if (!sender) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      to?: string;
      content?: string;
      conversation_id?: string;
    };

    if (!body.content?.trim()) return NextResponse.json({ ok: false, message: "内容不能为空" }, { status: 400 });
    if (body.content.length > 2000) return NextResponse.json({ ok: false, message: "消息过长（最多 2000 字）" }, { status: 400 });

    let conversationId = body.conversation_id;

    if (!conversationId) {
      if (!body.to?.trim()) return NextResponse.json({ ok: false, message: "缺少收件人" }, { status: 400 });
      if (body.to.trim() === sender) return NextResponse.json({ ok: false, message: "不能给自己发消息" }, { status: 400 });

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.to.trim())) return NextResponse.json({ ok: false, message: "收件人邮箱格式错误" }, { status: 400 });

      const [a, b] = sorted(sender, body.to.trim());
      conversationId = await withTransaction(async (q) => {
        const existing = await q<{ id: string }>(
          `SELECT id FROM public.conversations WHERE user_a_email = $1 AND user_b_email = $2 LIMIT 1`,
          [a, b],
        );
        if (existing.length > 0) return existing[0].id;

        const created = await q<{ id: string }>(
          `INSERT INTO public.conversations (user_a_email, user_b_email) VALUES ($1, $2) RETURNING id`,
          [a, b],
        );
        return created[0].id;
      });
    }

    await query(
      `INSERT INTO public.messages (conversation_id, sender_email, content)
       VALUES ($1, $2, $3)`,
      [conversationId, sender, body.content.trim()],
    );
    await query(
      `UPDATE public.conversations SET last_message_at = NOW() WHERE id = $1`,
      [conversationId],
    );

    return NextResponse.json({ ok: true, conversation_id: conversationId });
  } catch (e) {
    console.error("[messages] POST error:", e);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}

type ConversationRow = {
  id: string;
  other_email: string;
  other_name: string | null;
  other_avatar: string | null;
  other_role: string | null;
  other_rainbow_enabled: boolean | null;
  other_rainbow_until: Date | string | null;
  last_message: string;
  last_message_time: string;
  last_sender_email: string | null;
  unread: string;
};

/** 对话列表 — 含对方资料、最后消息、未读数（单条大 SQL） */
export async function GET() {
  try {
    await ensureOnce();
    const session = await auth();
    const me = session?.user?.email;
    if (!me) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

    const rows = await query<ConversationRow>(
      `SELECT c.id,
              CASE WHEN c.user_a_email = $1 THEN c.user_b_email ELSE c.user_a_email END AS other_email,
              u.name AS other_name,
              u.avatar_url AS other_avatar,
              u.role AS other_role,
              u.rainbow_enabled AS other_rainbow_enabled,
              u.rainbow_until AS other_rainbow_until,
              lm.content AS last_message,
              lm.created_at AS last_message_time,
              lm.sender_email AS last_sender_email,
              COALESCE((
                SELECT COUNT(*)::text
                  FROM public.messages m
                 WHERE m.conversation_id = c.id
                   AND m.sender_email != $1
                   AND m.content NOT LIKE '[举报违规]%'
                   AND (cr.last_read_at IS NULL OR m.created_at > cr.last_read_at)
              ), '0') AS unread
         FROM public.conversations c
         LEFT JOIN public.account_users u
           ON u.email = CASE WHEN c.user_a_email = $1 THEN c.user_b_email ELSE c.user_a_email END
         LEFT JOIN public.conversation_reads cr
           ON cr.conversation_id = c.id AND cr.user_email = $1,
         LATERAL (
           SELECT m.content, m.sender_email, m.created_at
             FROM public.messages m
            WHERE m.conversation_id = c.id
              AND m.content NOT LIKE '[举报违规]%'
            ORDER BY m.created_at DESC
            LIMIT 1
         ) lm
        WHERE c.user_a_email = $1 OR c.user_b_email = $1
        ORDER BY c.last_message_at DESC`,
      [me],
    );

    const conversations = rows.map((r) => ({
      id: r.id,
      other_email: r.other_email,
      other_name: r.other_name ?? r.other_email.split("@")[0],
      other_avatar: r.other_avatar ?? null,
      other_rainbow: isRainbowName({
        role: r.other_role,
        rainbow_enabled: r.other_rainbow_enabled,
        rainbow_until: r.other_rainbow_until,
      }),
      last_message: r.last_message ?? "",
      last_message_time: r.last_message_time ?? "",
      last_sender_email: r.last_sender_email,
      unread: parseInt(r.unread, 10),
    }));

    return NextResponse.json({ ok: true, conversations });
  } catch (e) {
    console.error("[messages] GET list error:", e);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}
