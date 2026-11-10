import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/password";

/**
 * POST /api/account/reset-password
 *
 * 重置当前登录账号的密码。
 * 调用方必须已通过 GitHub 授权（登录态即验证凭证），
 * 因此这里只要求存在登录态，不接收邮箱参数，避免越权重置他人密码。
 */
export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, message: "验证已失效，请重新验证身份" }, { status: 401 });
  }

  let body: { password?: string; confirmPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "无效 JSON" }, { status: 400 });
  }

  const password = String(body.password ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");

  if (!password.trim()) {
    return NextResponse.json({ ok: false, message: "请填写新密码" }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ ok: false, message: "两次输入的密码不一致" }, { status: 400 });
  }

  try {
    const passwordHash = await hashPassword(password);
    const rows = await query<{ id: string }>(
      `UPDATE public.account_users
          SET password_hash = $2, updated_at = NOW()
        WHERE email = $1
      RETURNING id`,
      [email, passwordHash],
    );
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, message: "账号不存在" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, message: "密码已重置，请使用新密码登录" });
  } catch (err) {
    console.error("[account/reset-password] POST error:", err);
    return NextResponse.json({ ok: false, message: "服务器错误，请稍后重试" }, { status: 500 });
  }
}
