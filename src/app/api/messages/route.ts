/**
 * 消息 API — 发送消息 + 收件箱/发件箱
 *
 * POST  /api/messages        → 发送一条消息（自动创建/复用对话）
 * GET   /api/messages        → 收件箱 + 发件箱（按消息扁平展示）
 * PATCH /api/messages        → 标记已读（单条会话 / 全部）
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
      toAdmin?: boolean;
      content?: string;
      conversation_id?: string;
    };

    if (!body.content?.trim())
      return NextResponse.json({ ok: false, message: "内容不能为空" }, { status: 400 });
    if (body.content.length > 10000)
      return NextResponse.json(
        { ok: false, message: "消息过长（最多 10000 字）" },
        { status: 400 },
      );

    let conversationId = body.conversation_id;

    // 联系管理：收件人由服务端解析，避免前端写死的邮箱与真实管理员不一致
    let to = body.to?.trim();
    if (!conversationId && body.toAdmin) {
      const admins = await query<{ email: string }>(
        `SELECT email FROM public.account_users
          WHERE role = 'admin'
          ORDER BY created_at ASC
          LIMIT 1`,
      );
      if (admins.length === 0) {
        return NextResponse.json(
          { ok: false, message: "暂未找到管理员账号，请稍后再试" },
          { status: 400 },
        );
      }
      to = admins[0].email;
    }

    if (!conversationId) {
      if (!to) return NextResponse.json({ ok: false, message: "缺少收件人" }, { status: 400 });
      if (to === sender)
        return NextResponse.json({ ok: false, message: "不能给自己发消息" }, { status: 400 });

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to))
        return NextResponse.json({ ok: false, message: "收件人邮箱格式错误" }, { status: 400 });

      const [a, b] = sorted(sender, to);
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
    await query(`UPDATE public.conversations SET last_message_at = NOW() WHERE id = $1`, [
      conversationId,
    ]);

    return NextResponse.json({ ok: true, conversation_id: conversationId });
  } catch (e) {
    console.error("[messages] POST error:", e);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}

type InboxRow = {
  id: string;
  conversation_id: string;
  sender_email: string;
  sender_name: string | null;
  sender_avatar: string | null;
  sender_role: string | null;
  sender_rainbow_enabled: boolean | null;
  sender_rainbow_until: Date | string | null;
  content: string;
  created_at: string;
  unread: boolean;
};

type OutboxRow = {
  id: string;
  conversation_id: string;
  recipient_email: string;
  recipient_name: string | null;
  recipient_avatar: string | null;
  recipient_role: string | null;
  recipient_rainbow_enabled: boolean | null;
  recipient_rainbow_until: Date | string | null;
  content: string;
  created_at: string;
  seen: boolean;
};

/** 收件箱 + 发件箱（按消息扁平展示） */
export async function GET() {
  try {
    await ensureOnce();
    const session = await auth();
    const me = session?.user?.email;
    if (!me) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

    const [inboxRows, outboxRows] = await Promise.all([
      query<InboxRow>(
        `SELECT m.id,
                m.conversation_id,
                m.sender_email,
                u.name AS sender_name,
                u.avatar_url AS sender_avatar,
                u.role AS sender_role,
                u.rainbow_enabled AS sender_rainbow_enabled,
                u.rainbow_until AS sender_rainbow_until,
                m.content,
                m.created_at,
                (cr.last_read_at IS NULL OR m.created_at > cr.last_read_at) AS unread
           FROM public.messages m
           JOIN public.conversations c ON c.id = m.conversation_id
           LEFT JOIN public.account_users u ON u.email = m.sender_email
           LEFT JOIN public.conversation_reads cr
             ON cr.conversation_id = c.id AND cr.user_email = $1
          WHERE (c.user_a_email = $1 OR c.user_b_email = $1)
            AND m.sender_email <> $1
            AND m.content NOT LIKE '[举报违规]%'
          ORDER BY m.created_at DESC
          LIMIT 200`,
        [me],
      ),
      query<OutboxRow>(
        `SELECT m.id,
                m.conversation_id,
                CASE WHEN c.user_a_email = $1 THEN c.user_b_email ELSE c.user_a_email END AS recipient_email,
                u.name AS recipient_name,
                u.avatar_url AS recipient_avatar,
                u.role AS recipient_role,
                u.rainbow_enabled AS recipient_rainbow_enabled,
                u.rainbow_until AS recipient_rainbow_until,
                m.content,
                m.created_at,
                EXISTS (
                  SELECT 1
                    FROM public.conversation_reads cr2
                   WHERE cr2.conversation_id = c.id
                     AND cr2.user_email = CASE
                           WHEN c.user_a_email = $1 THEN c.user_b_email
                           ELSE c.user_a_email
                         END
                     AND cr2.last_read_at >= m.created_at
                ) AS seen
           FROM public.messages m
           JOIN public.conversations c ON c.id = m.conversation_id
           LEFT JOIN public.account_users u
             ON u.email = CASE WHEN c.user_a_email = $1 THEN c.user_b_email ELSE c.user_a_email END
          WHERE m.sender_email = $1
            AND m.content NOT LIKE '[举报违规]%'
          ORDER BY m.created_at DESC
          LIMIT 200`,
        [me],
      ),
    ]);

    const inbox = inboxRows.map((r) => ({
      id: r.id,
      conversation_id: r.conversation_id,
      sender_email: r.sender_email,
      sender_name: r.sender_name ?? r.sender_email.split("@")[0],
      sender_avatar: r.sender_avatar ?? null,
      sender_rainbow: isRainbowName({
        role: r.sender_role,
        rainbow_enabled: r.sender_rainbow_enabled,
        rainbow_until: r.sender_rainbow_until,
      }),
      content: r.content,
      created_at: r.created_at,
      unread: r.unread,
    }));

    const outbox = outboxRows.map((r) => ({
      id: r.id,
      conversation_id: r.conversation_id,
      recipient_email: r.recipient_email,
      recipient_name: r.recipient_name ?? r.recipient_email.split("@")[0],
      recipient_avatar: r.recipient_avatar ?? null,
      recipient_rainbow: isRainbowName({
        role: r.recipient_role,
        rainbow_enabled: r.recipient_rainbow_enabled,
        rainbow_until: r.recipient_rainbow_until,
      }),
      content: r.content,
      created_at: r.created_at,
      seen: r.seen,
    }));

    return NextResponse.json({
      ok: true,
      inbox,
      outbox,
      unread: inbox.reduce((sum, message) => sum + (message.unread ? 1 : 0), 0),
    });
  } catch (e) {
    console.error("[messages] GET error:", e);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}

/** 标记已读：{ all: true } 全部已读，或 { conversation_id, read_at } 标记到指定时间 */
export async function PATCH(req: Request) {
  try {
    await ensureOnce();
    const session = await auth();
    const me = session?.user?.email;
    if (!me) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      all?: boolean;
      conversation_id?: string;
      read_at?: string;
    };

    if (body.all) {
      await query(
        `INSERT INTO public.conversation_reads (conversation_id, user_email, last_read_at)
         SELECT id, $1, NOW()
           FROM public.conversations
          WHERE user_a_email = $1 OR user_b_email = $1
         ON CONFLICT (conversation_id, user_email)
         DO UPDATE SET last_read_at = NOW()`,
        [me],
      );
      return NextResponse.json({ ok: true });
    }

    if (!body.conversation_id)
      return NextResponse.json({ ok: false, message: "缺少会话" }, { status: 400 });

    const owned = await query<{ id: string }>(
      `SELECT id FROM public.conversations
        WHERE id = $1 AND (user_a_email = $2 OR user_b_email = $2)
        LIMIT 1`,
      [body.conversation_id, me],
    );
    if (owned.length === 0)
      return NextResponse.json({ ok: false, message: "会话不存在" }, { status: 404 });

    const readAt = body.read_at ? new Date(body.read_at) : new Date();
    if (Number.isNaN(readAt.getTime()))
      return NextResponse.json({ ok: false, message: "时间格式错误" }, { status: 400 });

    await query(
      `INSERT INTO public.conversation_reads (conversation_id, user_email, last_read_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (conversation_id, user_email)
       DO UPDATE SET last_read_at = GREATEST(public.conversation_reads.last_read_at, EXCLUDED.last_read_at)`,
      [body.conversation_id, me, readAt.toISOString()],
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[messages] PATCH error:", e);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}
