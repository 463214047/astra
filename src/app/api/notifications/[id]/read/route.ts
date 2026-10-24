/**
 * 通知已读 — 单条
 *
 * PATCH /api/notifications/:id/read
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

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureOnce();
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

    const { id } = await params;

    const result = await query<{ id: string }>(
      `UPDATE public.notifications
          SET is_read = TRUE
        WHERE id = $1 AND recipient_email = $2
        RETURNING id`,
      [id, email],
    );

    if (result.length === 0) {
      return NextResponse.json({ ok: false, message: "通知不存在" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notifications PATCH :id/read]", err);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}
