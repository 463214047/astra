import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";

export default async function ProtectedLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }

  // 从未设置过密码的账号（如新用户 GitHub 快捷登录）先去设置密码
  const rows = await query<{ password_hash: string | null }>(
    `SELECT password_hash FROM public.account_users WHERE email = $1 LIMIT 1`,
    [session.user.email],
  );
  if (rows.length > 0 && !rows[0].password_hash) {
    redirect("/reset-password");
  }

  return <>{children}</>;
}
