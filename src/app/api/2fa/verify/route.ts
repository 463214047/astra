import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query, ensureSchema } from "@/lib/db";
import { verifyCode, decryptSecret } from "@/lib/totp";

const p = "/api/2fa/verify";

let schemaEnsured = false;
async function ensureOnce() {
  if (schemaEnsured) return;
  await ensureSchema();
  schemaEnsured = true;
}

/** 用户输入 TOTP 验证码，验证成功后把 totp_enabled 设为 true */
export async function PUT(req: Request) {
  try {
    await ensureOnce();
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { code?: string };
    const code = body.code?.trim();
    if (!code || !/^\d{6}$/.test(code))
      return NextResponse.json({ ok: false, message: "请输入 6 位验证码" }, { status: 400 });

    const users = await query<{
      id: string;
      totp_secret_enc: string | null;
      totp_enabled: boolean;
    }>(
      `SELECT id, totp_secret_enc, totp_enabled FROM public.account_users WHERE email = $1 LIMIT 1`,
      [email],
    );
    if (users.length === 0)
      return NextResponse.json({ ok: false, message: "用户不存在" }, { status: 404 });
    const user = users[0];

    if (user.totp_enabled)
      return NextResponse.json({ ok: false, message: "2FA 已启用" }, { status: 400 });
    if (!user.totp_secret_enc)
      return NextResponse.json({ ok: false, message: "请先执行 setup" }, { status: 400 });

    const secret = decryptSecret(user.totp_secret_enc);
    if (!secret)
      return NextResponse.json(
        { ok: false, message: "secret 解密失败，请重新 setup" },
        { status: 500 },
      );

    const offset = verifyCode(secret, code);
    if (offset === null)
      return NextResponse.json({ ok: false, message: "验证码错误" }, { status: 400 });

    await query(
      `UPDATE public.account_users
          SET totp_enabled = TRUE, last_totp_used = $1, updated_at = NOW()
        WHERE id = $2`,
      [String(Math.floor(Date.now() / 1000 / 30)), user.id],
    );

    return NextResponse.json({ ok: true, message: "2FA 已启用" });
  } catch (e) {
    console.error(`[2fa${p}] error:`, e);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}
