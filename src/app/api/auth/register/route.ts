import { NextResponse } from "next/server";
import { query, ensureSchema } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RegisterBody {
  email?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
  name?: unknown;
  code?: unknown;
}

interface ValidationError {
  field?: string;
  message: string;
}

function validateInput(body: RegisterBody): ValidationError[] {
  const errors: ValidationError[] = [];
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");
  const name = String(body.name ?? "").trim();
  const code = String(body.code ?? "").trim();

  if (!email) {
    errors.push({ field: "email", message: "请填写邮箱地址" });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: "email", message: "邮箱格式不正确" });
  } else if (email.length > 254) {
    errors.push({ field: "email", message: "邮箱长度不能超过 254 字符" });
  }

  if (!password) {
    errors.push({ field: "password", message: "请填写密码" });
  }

  if (password && confirmPassword && password !== confirmPassword) {
    errors.push({ field: "confirmPassword", message: "两次输入的密码不一致" });
  } else if (password && !confirmPassword) {
    errors.push({ field: "confirmPassword", message: "请再次输入密码" });
  }

  if (name && name.length > 50) {
    errors.push({ field: "name", message: "昵称长度不能超过 50 字符" });
  }

  if (!code) {
    errors.push({ field: "code", message: "请填写邮箱验证码" });
  } else if (!/^\d{6}$/.test(code)) {
    errors.push({ field: "code", message: "验证码格式错误（应为 6 位数字）" });
  }

  return errors;
}

export async function POST(request: Request) {
  let body: RegisterBody;

  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: { message: "请求格式错误，需要 JSON body" } },
      { status: 400 },
    );
  }

  // 1. 输入校验
  const errors = validateInput(body);
  if (errors.length > 0) {
    return NextResponse.json(
      { ok: false, error: { message: errors[0].message, details: errors } },
      { status: 400 },
    );
  }

  const email = String(body.email).trim().toLowerCase();
  const password = String(body.password);
  const name = String(body.name ?? "").trim() || null;
  const code = String(body.code).trim();

  try {
    // 2. 确保表存在
    await ensureSchema();

    // 3. 检查邮箱是否已注册
    const existing = await query<{ email: string }>(
      "SELECT email FROM public.account_users WHERE email = $1 LIMIT 1",
      [email],
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { ok: false, error: { message: "该邮箱已被注册，请直接登录" } },
        { status: 409 },
      );
    }

    // 4. 校验邮箱验证码
    const codes = await query<{ id: string }>(
      `SELECT id FROM public.email_verification_codes
       WHERE email = $1 AND code = $2 AND purpose = 'register'
         AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email, code],
    );

    if (codes.length === 0) {
      return NextResponse.json(
        { ok: false, error: { message: "验证码错误或已过期" } },
        { status: 400 },
      );
    }

    // 一次性使用 — 标记为已用
    await query("UPDATE public.email_verification_codes SET used = TRUE WHERE id = $1", [
      codes[0].id,
    ]);

    // 5. 哈希密码
    const passwordHash = await hashPassword(password);

    // 6. 写入数据库
    const rows = await query<{
      id: string;
      email: string;
      name: string | null;
      created_at: string;
    }>(
      `INSERT INTO public.account_users (email, name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, created_at`,
      [email, name, passwordHash],
    );

    const user = rows[0];

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        message: "注册成功，请使用邮箱密码登录",
      },
      { status: 201 },
    );
  } catch (err) {
    // 唯一约束冲突兜底（并发注册同一邮箱）
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate key")) {
      return NextResponse.json(
        { ok: false, error: { message: "该邮箱已被注册，请直接登录" } },
        { status: 409 },
      );
    }

    console.error("[register] 服务器错误:", err);
    return NextResponse.json(
      { ok: false, error: { message: "服务器内部错误，请稍后重试" } },
      { status: 500 },
    );
  }
}
