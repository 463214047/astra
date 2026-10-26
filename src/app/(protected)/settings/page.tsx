import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureSchema, query } from "@/lib/db";
import SettingsClient from "./SettingsClient";

export const metadata = { title: "账户设置" };

type SettingsRow = {
  name: string | null;
  avatar_url: string | null;
};

export default async function SettingsPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  await ensureSchema();

  const rows = await query<SettingsRow>(
    `SELECT name, avatar_url
       FROM public.account_users
      WHERE email = $1
      LIMIT 1`,
    [email],
  );

  const user = rows[0];
  if (!user) redirect("/login");

  return (
    <SettingsClient
      initialProfile={{
        nickname: user.name ?? "",
        avatarUrl: user.avatar_url ?? "",
      }}
    />
  );
}
