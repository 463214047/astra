/**
 * 全部标记已读
 *
 * PATCH /api/notifications/read-all        → 当前用户所有通知
 * PATCH /api/notifications/read-all?type=reply
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

export async function PATCH(req: Request) {
  try {
    await ensureOnce();
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

    const url = new URL(req.url);
    const type = url.searchParams.get("type");

    let sql = `UPDATE public.notifications SET is_read = TRUE WHERE recipient_email = $1 AND is_read = FALSE`;
    const params: unknown[] = [email];
    if (type === "system" || type === "reply") {
      sql += ` AND type = $2`;
      params.push(type);
    }

    await query(sql, params);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notifications read-all]", err);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}
