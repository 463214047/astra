/**
 * POST /api/auth/reset-password
 *
 * 用邮箱验证码重置密码（忘记密码场景）
 * Body: { email, code, password, confirmPassword }
 */

import { NextResponse } from "next/server";
import { query, ensureSchema } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ResetBody {
  email?: unknown;
  code?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
}

export async function POST(request: Request) {
  let body: ResetBody;
  try {
    body = (await request.json()) as ResetBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: { message: "请求格式错误，需要 JSON body" } },
      { status: 400 },
    );
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const code = String(body.code ?? "").trim();
  const password = String(body.password ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");

  // ---- 输入校验 ----
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: { message: "邮箱格式不正确" } }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { ok: false, error: { message: "验证码应为 6 位数字" } },
      { status: 400 },
    );
  }
  if (!password) {
    return NextResponse.json({ ok: false, error: { message: "请输入新密码" } }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json(
      { ok: false, error: { message: "两次输入的密码不一致" } },
      { status: 400 },
    );
  }

  try {
    await ensureSchema();

    // 1. 查用户（OAuth-only 账号也可通过邮箱验证设置密码）
    const users = await query<{ email: string }>(
      "SELECT email FROM public.account_users WHERE email = $1 LIMIT 1",
      [email],
    );
    if (users.length === 0) {
      // 故意用通用提示 — 防止枚举已注册邮箱
      return NextResponse.json(
        { ok: false, error: { message: "验证码错误或已过期" } },
        { status: 400 },
      );
    }

    // 2. 校验验证码（purpose=reset_password，未使用，未过期）
    const codes = await query<{ id: string }>(
      `SELECT id FROM public.email_verification_codes
       WHERE email = $1 AND code = $2 AND purpose = 'reset_password'
         AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email, code],
    );

    if (codes.length === 0) {
      return NextResponse.json(
        { ok: false, error: { message: "验证码错误或已过期" } },
        { status: 400 },
      );
    }

    // 3. 一次性使用 — 标记为已用
    await query("UPDATE public.email_verification_codes SET used = TRUE WHERE id = $1", [
      codes[0].id,
    ]);

    // 4. 哈希新密码 + 更新
    const passwordHash = await hashPassword(password);
    await query(
      `UPDATE public.account_users
       SET password_hash = $1, updated_at = NOW()
       WHERE email = $2`,
      [passwordHash, email],
    );

    return NextResponse.json({
      ok: true,
      message: "密码重置成功，请使用新密码登录",
    });
  } catch (err) {
    console.error("[reset-password] 服务器错误:", err);
    return NextResponse.json(
      { ok: false, error: { message: "服务器内部错误，请稍后重试" } },
      { status: 500 },
    );
  }
}
