import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureSchema, query } from "@/lib/db";
import { RAINBOW_ROLES, hasRainbowAccess } from "@/lib/rainbow";
import SettingsClient from "./SettingsClient";

export const metadata = { title: "账户设置" };

type SettingsRow = {
  name: string | null;
  avatar_url: string | null;
  role: string | null;
  rainbow_enabled: boolean | null;
  rainbow_until: Date | string | null;
  rainbow_claimed_ts: string | number | null;
  rainbow_ids: unknown;
};

function pendingRainbowDays(prizes: unknown, claimedTs: number): number {
  if (!Array.isArray(prizes)) return 0;

  let days = 0;
  for (const raw of prizes) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as { days?: unknown; ts?: unknown };
    const d = Math.floor(Number(item.days));
    const ts = Number(item.ts);
    if (!Number.isFinite(d) || d <= 0) continue;
    if (!Number.isFinite(ts) || ts <= claimedTs) continue;
    days += d;
  }
  return days;
}

export default async function SettingsPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  await ensureSchema();

  const rows = await query<SettingsRow>(
    `SELECT u.name, u.avatar_url, u.role,
            u.rainbow_enabled, u.rainbow_until, u.rainbow_claimed_ts,
            COALESCE(w.rainbow_ids, '[]'::jsonb) AS rainbow_ids
       FROM public.account_users u
       LEFT JOIN public.game_wish_save w ON w.user_email = u.email
      WHERE u.email = $1
      LIMIT 1`,
    [email],
  );

  const user = rows[0];
  if (!user) redirect("/login");

  const rainbowPrivileged = !!user.role && RAINBOW_ROLES.has(user.role);
  const rainbowAccess = hasRainbowAccess({
    role: user.role,
    rainbow_until: user.rainbow_until,
  });
  const rainbowEnabled =
    (user.rainbow_enabled == null ? true : user.rainbow_enabled) && rainbowAccess;

  const rainbowUntil = user.rainbow_until ? new Date(user.rainbow_until) : null;
  const rainbowUntilIso =
    rainbowUntil && Number.isFinite(rainbowUntil.getTime()) ? rainbowUntil.toISOString() : null;

  const claimedTs = Number(user.rainbow_claimed_ts) || 0;
  const rainbowPrizeDays = rainbowPrivileged ? 0 : pendingRainbowDays(user.rainbow_ids, claimedTs);

  return (
    <SettingsClient
      initialProfile={{
        nickname: user.name ?? "",
        avatarUrl: user.avatar_url ?? "",
        rainbowEnabled,
        rainbowPrivileged,
        rainbowUntil: rainbowUntilIso,
        rainbowPrizeDays,
      }}
    />
  );
}
