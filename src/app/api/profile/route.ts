import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query, ensureSchema } from "@/lib/db";
import { hasRainbowAccess } from "@/lib/rainbow";
import { validateBBCode } from "@/lib/bbcode";

const NICKNAME_MIN = 1;
const NICKNAME_MAX = 20;
const SIGNATURE_MAX = 500;

const LOCAL_AVATAR_PATH = /^\/uploads\/avatars\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp)$/i;

/** 校验头像地址 — 允许 http(s) 链接或本地上传路径 */
function validateAvatarUrl(u: string): string | null {
  if (!u) return "头像地址不能为空";
  if (u.length > 500) return "头像地址过长";
  if (LOCAL_AVATAR_PATH.test(u)) return null;
  if (!/^https?:\/\/[^\s"<>]+$/i.test(u)) return "头像仅支持 http(s) 链接或本地上传图片";
  return null;
}

let schemaEnsured = false;
async function ensureOnce() {
  if (schemaEnsured) return;
  await ensureSchema();
  schemaEnsured = true;
}

/** 获取当前用户资料（用于保存后立即刷新） */
export async function GET() {
  try {
    await ensureOnce();
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

    const rows = await query<{
      name: string | null;
      avatar_url: string | null;
      signature: string | null;
      rainbow_enabled: boolean | null;
      rainbow_until: Date | string | null;
    }>(
      `SELECT name, avatar_url, signature, rainbow_enabled, rainbow_until
         FROM public.account_users WHERE email = $1 LIMIT 1`,
      [email],
    );
    if (rows.length === 0) return NextResponse.json({ ok: false, message: "用户不存在" }, { status: 404 });
    return NextResponse.json({ ok: true, ...rows[0] });
  } catch (e) {
    console.error("[profile] GET error:", e);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}

/** 更新资料 */
export async function PATCH(req: Request) {
  try {
    await ensureOnce();
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      nickname?: string;
      avatar_url?: string;
      signature?: string;
      rainbow_enabled?: boolean;
    };

    // ---- 校验 ----
    const errors: Record<string, string> = {};

    // nickname（映射到 DB 的 name 列）
    if (body.nickname !== undefined) {
      const n = body.nickname.trim();
      if (n.length < NICKNAME_MIN || n.length > NICKNAME_MAX) {
        errors.nickname = `昵称长度 ${NICKNAME_MIN}-${NICKNAME_MAX} 字符`;
      }
      // 禁止控制字符
      if (/[\x00-\x1f]/.test(n)) errors.nickname = "昵称含非法字符";
    }

    // avatar_url
    if (body.avatar_url !== undefined) {
      if (body.avatar_url === "" || body.avatar_url === null) {
        // 允许清空
      } else {
        const err = validateAvatarUrl(body.avatar_url);
        if (err) errors.avatar_url = err;
      }
    }

    // signature
    if (body.signature !== undefined) {
      if (body.signature.length === 0) {
        // 允许清空
      } else {
        const err = validateBBCode(body.signature, SIGNATURE_MAX);
        if (err) errors.signature = err;
      }
    }

    // rainbow_enabled
    if (body.rainbow_enabled !== undefined) {
      if (typeof body.rainbow_enabled !== "boolean") {
        errors.rainbow_enabled = "参数无效";
      } else if (body.rainbow_enabled) {
        const u = await query<{ role: string; rainbow_until: Date | string | null }>(
          `SELECT role, rainbow_until FROM public.account_users WHERE email = $1 LIMIT 1`,
          [email],
        );
        if (!hasRainbowAccess({ role: u[0]?.role, rainbow_until: u[0]?.rainbow_until })) {
          errors.rainbow_enabled = "暂无可用的彩虹昵称时长";
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ ok: false, message: "输入无效", errors }, { status: 400 });
    }

    // ---- 构建 SQL ----
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (body.nickname !== undefined) {
      sets.push(`name = $${idx++}`);
      params.push(body.nickname.trim() || null);
    }
    if (body.avatar_url !== undefined) {
      sets.push(`avatar_url = $${idx++}`);
      const v = body.avatar_url;
      params.push(typeof v === "string" ? (v.trim() || null) : null);
    }
    if (body.signature !== undefined) {
      sets.push(`signature = $${idx++}`);
      const v = body.signature;
      params.push(typeof v === "string" ? (v.trim() || null) : null);
    }
    if (body.rainbow_enabled !== undefined) {
      sets.push(`rainbow_enabled = $${idx++}`);
      params.push(body.rainbow_enabled);
    }

    if (sets.length === 0) {
      return NextResponse.json({ ok: false, message: "无要更新的字段" }, { status: 400 });
    }

    params.push(email);
    const rows = await query<{
      name: string | null;
      avatar_url: string | null;
      signature: string | null;
      rainbow_enabled: boolean | null;
      rainbow_until: Date | string | null;
    }>(
      `UPDATE public.account_users
          SET ${sets.join(", ")}, updated_at = NOW()
        WHERE email = $${idx}
        RETURNING name, avatar_url, signature, rainbow_enabled, rainbow_until`,
      params,
    );

    if (rows.length === 0) return NextResponse.json({ ok: false, message: "用户不存在" }, { status: 404 });

    return NextResponse.json({ ok: true, ...rows[0] });
  } catch (e) {
    console.error("[profile] PATCH error:", e);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}
