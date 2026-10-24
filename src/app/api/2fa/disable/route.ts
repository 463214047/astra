import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query, ensureSchema } from "@/lib/db";
import { verifyCode, decryptSecret } from "@/lib/totp";
import { verifyPassword } from "@/lib/password";

const p = "/api/2fa/disable";

let schemaEnsured = false;
async function ensureOnce() {
  if (schemaEnsured) return;
  await ensureSchema();
  schemaEnsured = true;
}

/** 输入当前密码 + 一个有效的 TOTP 码后禁用 2FA */
export async function DELETE(req: Request) {
  try {
    await ensureOnce();
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { password?: string; code?: string };
    if (!body.password) return NextResponse.json({ ok: false, message: "请输入当前密码" }, { status: 400 });
    if (!body.code || !/^\d{6}$/.test(body.code))
      return NextResponse.json({ ok: false, message: "请输入 6 位验证码" }, { status: 400 });

    const users = await query<{
      id: string;
      password_hash: string | null;
      totp_enabled: boolean;
      totp_secret_enc: string | null;
    }>(
      `SELECT id, password_hash, totp_enabled, totp_secret_enc
         FROM public.account_users WHERE email = $1 LIMIT 1`,
      [email],
    );
    if (users.length === 0) return NextResponse.json({ ok: false, message: "用户不存在" }, { status: 404 });
    const user = users[0];

    if (!user.totp_enabled) return NextResponse.json({ ok: false, message: "2FA 未启用" }, { status: 400 });

    // OAuth-only 账号没有密码 — 不可能走到这里（无法启用 2FA），但防御性检查
    if (!user.password_hash) {
      return NextResponse.json(
        { ok: false, message: "请先设置密码后再操作" },
        { status: 400 },
      );
    }

    const pwdOk = await verifyPassword(body.password, user.password_hash);
    if (!pwdOk) return NextResponse.json({ ok: false, message: "密码错误" }, { status: 400 });

    if (user.totp_secret_enc) {
      const secret = decryptSecret(user.totp_secret_enc);
      if (secret) {
        const offset = verifyCode(secret, body.code);
        if (offset === null) return NextResponse.json({ ok: false, message: "验证码错误" }, { status: 400 });
      }
    }

    await query(
      `UPDATE public.account_users
          SET totp_secret_enc = NULL, totp_enabled = FALSE,
              recovery_codes_enc = NULL, last_totp_used = NULL, updated_at = NOW()
        WHERE id = $1`,
      [user.id],
    );

    return NextResponse.json({ ok: true, message: "2FA 已禁用" });
  } catch (e) {
    console.error(`[2fa${p}] error:`, e);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}
