/**
 * DELETE /api/oauth/unbind?provider=github
 * 解绑指定第三方账号
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

export async function DELETE(req: Request) {
  try {
    await ensureOnce();
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

    const url = new URL(req.url);
    const provider = url.searchParams.get("provider")?.trim().toLowerCase();
    if (!provider)
      return NextResponse.json({ ok: false, message: "缺少 provider 参数" }, { status: 400 });

    const ALLOWED = ["github", "google", "discord", "twitter"];
    if (!ALLOWED.includes(provider)) {
      return NextResponse.json({ ok: false, message: "不支持的 provider" }, { status: 400 });
    }

    // 检查解绑后是否还能登录
    const users = await query<{ password_hash: string | null }>(
      `SELECT password_hash FROM public.account_users WHERE email = $1 LIMIT 1`,
      [email],
    );
    const hasPassword = !!users[0]?.password_hash;

    const remaining = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM public.oauth_accounts WHERE user_email = $1 AND provider != $2`,
      [email, provider],
    );
    const remainingCount = parseInt(remaining[0]?.count ?? "0", 10);

    if (!hasPassword && remainingCount === 0) {
      return NextResponse.json(
        { ok: false, message: "解绑后将无法登录，请先设置密码或绑定其他登录方式" },
        { status: 400 },
      );
    }

    const before = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM public.oauth_accounts WHERE user_email = $1 AND provider = $2`,
      [email, provider],
    );
    const beforeCount = parseInt(before[0]?.count ?? "0", 10);

    await query(`DELETE FROM public.oauth_accounts WHERE user_email = $1 AND provider = $2`, [
      email,
      provider,
    ]);

    if (beforeCount === 0) {
      return NextResponse.json({ ok: false, message: "未找到绑定记录" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[oauth/unbind] DELETE error:", e);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}
