import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query, ensureSchema } from "@/lib/db";

const p = "/api/2fa/status";

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
      totp_enabled: boolean;
      totp_secret_enc: string | null;
      recovery_codes_enc: string | null;
      last_totp_used: string | null;
      password_hash: string | null;
    }>(
      `SELECT totp_enabled, totp_secret_enc, recovery_codes_enc, last_totp_used, password_hash
         FROM public.account_users WHERE email = $1 LIMIT 1`,
      [email],
    );

    if (rows.length === 0)
      return NextResponse.json({ ok: false, message: "用户不存在" }, { status: 404 });
    const r = rows[0];

    return NextResponse.json({
      ok: true,
      enabled: r.totp_enabled,
      hasRecoveryCodes: !!r.recovery_codes_enc,
      hasLastTotp: !!r.last_totp_used,
      hasPassword: !!r.password_hash,
    });
  } catch (e) {
    console.error(`[2fa${p}] error:`, e);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}
