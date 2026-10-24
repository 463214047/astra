/**
 * GET    /api/messages/:id — 对话详情（含全部消息 + 对方资料 + 已读状态）
 * PATCH  /api/messages/:id — 标记整个对话为已读
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query, ensureSchema } from "@/lib/db";
import { isRainbowName } from "@/lib/rainbow";

let schemaEnsured = false;
async function ensureOnce() {
  if (schemaEnsured) return;
  await ensureSchema();
  schemaEnsured = true;
}

async function ensureOwnsConversation(id: string, email: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM public.conversations
      WHERE id = $1 AND (user_a_email = $2 OR user_b_email = $2)
      LIMIT 1`,
    [id, email],
  );
  return rows.length > 0;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureOnce();
    const session = await auth();
    const me = session?.user?.email;
    if (!me) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

    const id = (await params).id;
    if (!await ensureOwnsConversation(id, me)) {
      return NextResponse.json({ ok: false, message: "对话不存在" }, { status: 404 });
    }

    // 基本信息
    const convs = await query<{
      id: string;
      other_email: string;
    }>(
      `SELECT c.id,
              CASE WHEN c.user_a_email = $1 THEN c.user_b_email ELSE c.user_a_email END AS other_email
         FROM public.conversations c WHERE c.id = $2`,
      [me, id],
    );
    const conv = convs[0];
    if (!conv) return NextResponse.json({ ok: false, message: "对话不存在" }, { status: 404 });

    // 对方资料
    const users = await query<{
      name: string | null;
      avatar_url: string | null;
      role: string;
      rainbow_enabled: boolean;
      rainbow_until: Date | string | null;
    }>(
      `SELECT name, avatar_url, role, rainbow_enabled, rainbow_until
         FROM public.account_users WHERE email = $1`,
      [conv.other_email],
    );
    const other = users[0];

    // 已读时间
    const reads = await query<{ last_read_at: string | null }>(
      `SELECT last_read_at FROM public.conversation_reads
        WHERE conversation_id = $1 AND user_email = $2`,
      [id, me],
    );
    const myLastRead = reads[0]?.last_read_at ?? null;

    // 对方最后已读（用于显示"对方已读你的消息"）
    const otherReads = await query<{ last_read_at: string | null }>(
      `SELECT last_read_at FROM public.conversation_reads
        WHERE conversation_id = $1 AND user_email = $2`,
      [id, conv.other_email],
    );
    const otherLastRead = otherReads[0]?.last_read_at ?? null;

    // 所有消息（升序）
    const msgs = await query<{
      id: string;
      sender_email: string;
      content: string;
      created_at: string;
      read_by_me: boolean;          // 对我方来说这条是否已读
      recipient_read_at: string | null; // 对方看到这条消息的时间（null=对方还没看到）
    }>(
      `SELECT m.id, m.sender_email, m.content, m.created_at,
              CASE WHEN $2::TIMESTAMPTZ IS NULL OR m.created_at <= $2::TIMESTAMPTZ THEN true ELSE false END AS read_by_me,
              $3::TIMESTAMPTZ AS recipient_read_at
         FROM public.messages m
        WHERE m.conversation_id = $1
          AND m.content NOT LIKE '[举报违规]%'
        ORDER BY m.created_at ASC`,
      [id, myLastRead, otherLastRead],
    );

    return NextResponse.json({
      ok: true,
      conversation: {
        id,
        other_email: conv.other_email,
        other_name: other?.name ?? conv.other_email.split("@")[0],
        other_avatar: other?.avatar_url ?? null,
        other_rainbow: isRainbowName({
          role: other?.role,
          rainbow_enabled: other?.rainbow_enabled,
          rainbow_until: other?.rainbow_until,
        }),
      },
      messages: msgs.map((m) => ({
        id: m.id,
        sender_email: m.sender_email,
        is_me: m.sender_email === me,
        content: m.content,
        created_at: m.created_at,
        read_by_me: m.read_by_me,
        recipient_has_seen: m.recipient_read_at !== null && m.created_at <= m.recipient_read_at,
      })),
    });
  } catch (e) {
    console.error("[messages/:id] GET error:", e);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}

/** 标记整个对话为已读（当前时间戳） */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureOnce();
    const session = await auth();
    const me = session?.user?.email;
    if (!me) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

    const id = (await params).id;
    if (!await ensureOwnsConversation(id, me)) {
      return NextResponse.json({ ok: false, message: "对话不存在" }, { status: 404 });
    }

    await query(
      `INSERT INTO public.conversation_reads (conversation_id, user_email, last_read_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (conversation_id, user_email)
       DO UPDATE SET last_read_at = NOW()`,
      [id, me],
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[messages/:id] PATCH error:", e);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}
