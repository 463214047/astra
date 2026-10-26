/**
 * POST /api/account/change-password
 * 已登录用户通过当前密码重设登录密码。
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureSchema, query } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

let schemaEnsured = false;
async function ensureOnce() {
  if (schemaEnsured) return;
  await ensureSchema();
  schemaEnsured = true;
}

export async function POST(req: Request) {
  try {
    await ensureOnce();
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      current_password?: unknown;
      new_password?: unknown;
      confirm_password?: unknown;
    };

    const currentPassword = typeof body.current_password === "string" ? body.current_password : "";
    const newPassword = typeof body.new_password === "string" ? body.new_password : "";
    const confirmPassword = typeof body.confirm_password === "string" ? body.confirm_password : "";

    if (!currentPassword) {
      return NextResponse.json({ ok: false, message: "请输入当前密码" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ ok: false, message: "新密码至少 6 位" }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ ok: false, message: "两次输入的新密码不一致" }, { status: 400 });
    }

    const rows = await query<{ password_hash: string | null }>(
      `SELECT password_hash FROM public.account_users WHERE email = $1 LIMIT 1`,
      [email],
    );
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, message: "账号不存在" }, { status: 404 });
    }
    if (!rows[0].password_hash) {
      return NextResponse.json(
        { ok: false, message: "当前账号未设置密码，请先在账号与绑定中设置密码" },
        { status: 400 },
      );
    }

    const valid = await verifyPassword(currentPassword, rows[0].password_hash);
    if (!valid) {
      return NextResponse.json({ ok: false, message: "当前密码错误" }, { status: 401 });
    }

    const passwordHash = await hashPassword(newPassword);
    await query(
      `UPDATE public.account_users
          SET password_hash = $1, updated_at = NOW()
        WHERE email = $2`,
      [passwordHash, email],
    );

    return NextResponse.json({ ok: true, message: "密码已重设" });
  } catch (e) {
    console.error("[account/change-password] POST error:", e);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}
