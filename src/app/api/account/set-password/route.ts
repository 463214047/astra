/**
 * POST /api/account/set-password
 * 给 OAuth-only 账号设置登录密码（无密码 → 设密码后就变成 credentials 账号了）
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query, ensureSchema } from "@/lib/db";
import { hashPassword } from "@/lib/password";

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

    const body = await req.json();
    const newPwd = typeof body?.new_password === "string" ? body.new_password : "";
    const confirmPwd = typeof body?.confirm_password === "string" ? body.confirm_password : "";

    if (!newPwd.trim()) {
      return NextResponse.json({ ok: false, message: "请输入密码" }, { status: 400 });
    }
    if (newPwd !== confirmPwd) {
      return NextResponse.json({ ok: false, message: "两次输入的密码不一致" }, { status: 400 });
    }

    const users = await query<{ password_hash: string | null }>(
      `SELECT password_hash FROM public.account_users WHERE email = $1 LIMIT 1`,
      [email],
    );
    if (users.length === 0) {
      return NextResponse.json({ ok: false, message: "账号不存在" }, { status: 404 });
    }

    // 已有密码 → 走修改密码流程（不在此端点）
    if (users[0].password_hash) {
      return NextResponse.json(
        { ok: false, message: "该账号已有密码，请使用修改密码功能" },
        { status: 400 },
      );
    }

    const hash = await hashPassword(newPwd);
    await query(`UPDATE public.account_users SET password_hash = $1 WHERE email = $2`, [
      hash,
      email,
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[account/set-password] POST error:", e);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}
