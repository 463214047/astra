import { query } from "./db";
import { randomBytes } from "node:crypto";

/** 生成 32 字符 hex passkey */
function generatePasskey(): string {
  return randomBytes(16).toString("hex");
}

/**
 * 获取用户 passkey，没有就自动生成一个
 */
export async function ensureUserPasskey(email: string): Promise<string> {
  const rows = await query<{ passkey: string }>(
    "SELECT passkey FROM public.user_passkeys WHERE user_email = $1",
    [email],
  );
  if (rows.length > 0) return rows[0].passkey;

  const pk = generatePasskey();
  await query(
    `INSERT INTO public.user_passkeys (user_email, passkey)
     VALUES ($1, $2)
     ON CONFLICT (user_email) DO NOTHING`,
    [email, pk],
  );
  return pk;
}

export async function getUserByPasskey(passkey: string): Promise<string | null> {
  const rows = await query<{ user_email: string }>(
    "SELECT user_email FROM public.user_passkeys WHERE passkey = $1",
    [passkey],
  );
  return rows.length > 0 ? rows[0].user_email : null;
}
