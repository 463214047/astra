import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query, ensureSchema } from "@/lib/db";

/**
 * 老的 /profile 路由 —— 现在改成 redirect 到当前用户的 /users/[uid]
 * 保持向后兼容（书签 / navbar 里可能还有旧 link）
 */
export default async function ProfileRedirect() {
  const session = await auth();
  const email = session?.user?.email ?? "";

  await ensureSchema();

  const rows = await query<{ uid: number }>(
    `SELECT uid FROM public.account_users WHERE email = $1 LIMIT 1`,
    [email],
  );

  if (rows.length === 0) {
    // 极端情况：session 有 email 但 DB 没记录 — 走 /users/0 会 404，不如跳首页
    redirect("/");
  }

  redirect(`/users/${rows[0].uid}`);
}
