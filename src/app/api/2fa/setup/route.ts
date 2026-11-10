import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query, ensureSchema } from "@/lib/db";
import { generateSecret, encryptSecret, generateAuthUrl } from "@/lib/totp";
import { verifyPassword } from "@/lib/password";

const p = "/api/2fa/setup";

let schemaEnsured = false;
async function ensureOnce() {
  if (schemaEnsured) return;
  await ensureSchema();
  schemaEnsured = true;
}

/**
 * 生成 secret + authUrl（返回 QR 扫码所需数据）
 * 此时 totp_enabled = false，用户需走 verify 才真正启用
 */
export async function POST(req: Request) {
  try {
    await ensureOnce();
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { password?: string };
    if (!body.password)
      return NextResponse.json({ ok: false, message: "请输入当前密码以确认身份" }, { status: 400 });

    const users = await query<{
      id: string;
      password_hash: string | null;
      totp_enabled: boolean;
    }>(
      `SELECT id, password_hash, totp_enabled FROM public.account_users WHERE email = $1 LIMIT 1`,
      [email],
    );
    if (users.length === 0)
      return NextResponse.json({ ok: false, message: "用户不存在" }, { status: 404 });
    const user = users[0];

    // OAuth-only 账号没有密码 — 无法通过密码验证身份 → 必须先设置密码
    if (!user.password_hash) {
      return NextResponse.json(
        { ok: false, message: "请先在账号设置中设置密码，再启用两步验证" },
        { status: 400 },
      );
    }

    const pwdOk = await verifyPassword(body.password, user.password_hash);
    if (!pwdOk) return NextResponse.json({ ok: false, message: "密码错误" }, { status: 400 });

    if (user.totp_enabled)
      return NextResponse.json(
        { ok: false, message: "2FA 已启用，请先禁用后再重新设置" },
        { status: 400 },
      );

    const secret = generateSecret();
    const secretEnc = encryptSecret(secret);
    const authUrl = generateAuthUrl({
      issuer: "DeepSeed",
      label: email,
      secret,
    });

    await query(
      `UPDATE public.account_users
          SET totp_secret_enc = $1, recovery_codes_enc = NULL, last_totp_used = NULL, updated_at = NOW()
        WHERE id = $2`,
      [secretEnc, user.id],
    );

    return NextResponse.json({
      ok: true,
      authUrl,
    });
  } catch (e) {
    console.error(`[2fa${p}] error:`, e);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}
