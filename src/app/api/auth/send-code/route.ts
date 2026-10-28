/**
 * POST /api/auth/send-code
 *
 * 发送邮箱验证码（注册场景）
 * Body: { email: string, purpose?: 'register' | 'reset_password' }
 *
 * 限制：
 * - 同一邮箱 60 秒内只能发一次
 * - 同一 IP 每小时最多 20 次
 */

import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { query, ensureSchema } from "@/lib/db";
import { sendRegisterCode, sendResetCode } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TODO: 生产环境 serverless（Vercel）下内存 Map 限流会失效（每次冷启动重置）
//       部署时改用 Redis / DB 字段做限流存储
const emailCooldown = new Map<string, number>(); // email → last sent timestamp
const ipCooldown = new Map<string, { count: number; windowStart: number }>(); // ip → stats

const EMAIL_COOLDOWN_MS = 60_000; // 60 秒
const IP_WINDOW_MS = 60 * 60 * 1000; // 1 小时
const IP_MAX_PER_WINDOW = 20;

function genCode(): string {
  // 6 位数字，去掉易混淆的 0/O/1/I
  const chars = "23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[randomInt(chars.length)];
  }
  return code;
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  let body: { email?: unknown; purpose?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式错误" }, { status: 400 });
  }

  const rawEmail = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const purpose = body.purpose === "reset_password" ? "reset_password" : "register";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return NextResponse.json({ ok: false, message: "邮箱格式不正确" }, { status: 400 });
  }

  try {
    await ensureSchema();

    // 注册场景：检查是否已被注册
    if (purpose === "register") {
      const existing = await query<{ email: string }>(
        "SELECT email FROM public.account_users WHERE email = $1 LIMIT 1",
        [rawEmail],
      );
      if (existing.length > 0) {
        return NextResponse.json(
          { ok: false, message: "该邮箱已被注册，请直接登录" },
          { status: 409 },
        );
      }
    }

    // 重置密码场景：邮箱必须已注册；OAuth-only 账号也可通过邮箱验证设置密码
    if (purpose === "reset_password") {
      const existing = await query<{ email: string }>(
        "SELECT email FROM public.account_users WHERE email = $1 LIMIT 1",
        [rawEmail],
      );
      if (existing.length === 0) {
        return NextResponse.json({ ok: false, message: "该邮箱未注册" }, { status: 404 });
      }
    }

    // ---- 限流检查 ----
    const now = Date.now();
    const ip = getClientIp(req);

    // per-email 冷却
    const lastSent = emailCooldown.get(rawEmail) ?? 0;
    if (now - lastSent < EMAIL_COOLDOWN_MS) {
      const remaining = Math.ceil((EMAIL_COOLDOWN_MS - (now - lastSent)) / 1000);
      return NextResponse.json(
        { ok: false, message: `请等待 ${remaining} 秒后再试` },
        { status: 429 },
      );
    }

    // per-ip 限流
    const ipStat = ipCooldown.get(ip);
    if (ipStat) {
      if (now - ipStat.windowStart > IP_WINDOW_MS) {
        ipStat.count = 0;
        ipStat.windowStart = now;
      }
      if (ipStat.count >= IP_MAX_PER_WINDOW) {
        return NextResponse.json(
          { ok: false, message: "请求过于频繁，请稍后再试" },
          { status: 429 },
        );
      }
      ipStat.count++;
    } else {
      ipCooldown.set(ip, { count: 1, windowStart: now });
    }

    // ---- 生成验证码 ----
    const code = genCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 分钟

    // 清理该邮箱 + purpose 的旧未使用验证码，再插入新的
    await query(
      `DELETE FROM public.email_verification_codes
       WHERE email = $1 AND purpose = $2 AND used = FALSE`,
      [rawEmail, purpose],
    );
    await query(
      `INSERT INTO public.email_verification_codes (email, code, purpose, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [rawEmail, code, purpose, expiresAt],
    );

    // ---- 发送邮件 ----
    const sender = purpose === "reset_password" ? sendResetCode : sendRegisterCode;
    const result = await sender(rawEmail, code);

    // 更新限流 timestamp（无论 Resend 成败都冷却，避免滥发）
    emailCooldown.set(rawEmail, now);

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: "邮件发送失败，请稍后再试" }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      message: "验证码已发送，10 分钟内有效",
      // 仅在 fallback（开发环境）返回预览方便调试
      ...(result.method === "fallback" && result.preview ? { _dev_code: code } : {}),
    });
  } catch (err) {
    console.error("[send-code] 服务器错误:", err);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}
