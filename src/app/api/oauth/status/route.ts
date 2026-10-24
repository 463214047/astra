/**
 * GET /api/oauth/status
 * 列出当前用户所有已绑定的第三方账号
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

export async function GET() {
  try {
    await ensureOnce();
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

    const rows = await query<{
      provider: string;
      provider_name: string | null;
      provider_avatar: string | null;
      created_at: string;
    }>(
      `SELECT provider, provider_name, provider_avatar, created_at
         FROM public.oauth_accounts WHERE user_email = $1 ORDER BY created_at`,
      [email],
    );

    // 查是否有密码（判断能否走 credentials 登录 / 能否解绑后仍能登录）
    const u = await query<{ password_hash: string | null }>(
      `SELECT password_hash FROM public.account_users WHERE email = $1`,
      [email],
    );

    return NextResponse.json({
      ok: true,
      accounts: rows,
      has_password: !!u[0]?.password_hash,
    });
  } catch (e) {
    console.error("[oauth/status] GET error:", e);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}
