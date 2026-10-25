/**
 * DELETE /api/account — 注销当前账号
 *
 * 需要：current_password（明文字符串，服务端用同一个 scrypt 流程校验）
 *
 * 行为：
 *   1. 校验当前密码
 *   2. 删除所有关联数据（messages / conversations / 2FA / profile 都级联）
 *   3. 删除 account_users 记录
 *   4. 返回成功后客户端 signOut + redirect /login
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query, ensureSchema, withTransaction } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

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

    const body = (await req.json().catch(() => ({}))) as { current_password?: string };
    if (!body.current_password) {
      return NextResponse.json({ ok: false, message: "请输入当前密码" }, { status: 400 });
    }

    // 查密码哈希
    const rows = await query<{ password_hash: string | null }>(
      `SELECT password_hash FROM public.account_users WHERE email = $1 LIMIT 1`,
      [email],
    );
    if (rows.length === 0)
      return NextResponse.json({ ok: false, message: "账号不存在" }, { status: 404 });

    // GitHub 登录的账号没有 password_hash → 不支持密码验证
    if (!rows[0].password_hash) {
      return NextResponse.json(
        { ok: false, message: "当前账号未设置密码，请联系管理员注销" },
        { status: 400 },
      );
    }

    const valid = await verifyPassword(body.current_password, rows[0].password_hash);
    if (!valid) {
      return NextResponse.json({ ok: false, message: "密码错误" }, { status: 401 });
    }

    // 级联删除（transaction）
    await withTransaction(async (q) => {
      // 对方是 conversation 的另一边也会被 cascade 删除
      // 但 conversation_reads 里对方的记录不会被 FK cascade（只对 conversation_id 有 cascade）
      // 所以先删 reads（对所有涉及的 conversation）
      const convIds = await q<{ id: string }>(
        `SELECT id FROM public.conversations WHERE user_a_email = $1 OR user_b_email = $1`,
        [email],
      );
      if (convIds.length > 0) {
        await q(`DELETE FROM public.conversation_reads WHERE conversation_id = ANY($1)`, [
          convIds.map((c) => c.id),
        ]);
      }

      // 删除用户（messages 和 conversations 通过 FK ON DELETE CASCADE 自动清理）
      await q(`DELETE FROM public.account_users WHERE email = $1`, [email]);
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[account] DELETE error:", e);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}
