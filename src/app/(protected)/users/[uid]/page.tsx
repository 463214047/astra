import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";

import { auth } from "@/auth";
import { query, ensureSchema } from "@/lib/db";
import { isRainbowName } from "@/lib/rainbow";
import { UserName } from "@/components/rainbow-name";

import OwnerProfile, { RoleBadge } from "./OwnerProfile";
import GuestProfile from "./GuestProfile";

type Row = {
  uid: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: "admin" | "staff" | "vip" | "user";
  created_at: string;
  wish_magic: number;
  seed_points: number;
  rainbow_enabled: boolean | null;
  rainbow_until: string | null;
};

export type UserStats = {
  magic: number;
  seedPoints: number; // 做种积分（公式待定，先读字段）
  uploaded: number; // 累计上传字节
  downloaded: number; // 累计下载字节
  shareRatio: number; // 分享率（uploaded / downloaded，至少 0）
};

function profileNickname(user: Pick<Row, "name" | "email" | "uid">) {
  return user.name?.trim() || user.email.split("@")[0] || `#${user.uid}`;
}

/** 同一请求内 generateMetadata 与页面共用，避免重复查询/初始化 */
const loadUser = cache(async (uid: number) => {
  await ensureSchema();
  const rows = await query<Row>(
    `SELECT uid, email, name, avatar_url,
            COALESCE(role, 'user') AS role,
            created_at,
            COALESCE(wish_magic, 16000) AS wish_magic,
            COALESCE(seed_points, 0) AS seed_points,
            rainbow_enabled, rainbow_until
     FROM public.account_users WHERE uid = $1 LIMIT 1`,
    [uid],
  );
  return rows[0] ?? null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ uid: string }>;
}): Promise<Metadata> {
  const { uid } = await params;
  if (!/^\d+$/.test(uid)) return { title: "用户主页" };

  const user = await loadUser(Number(uid));
  if (!user) return { title: "用户主页" };

  return { title: `${profileNickname(user)}的主页` };
}

export default async function UserProfilePage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;

  if (!/^\d+$/.test(uid)) notFound();
  const uidNum = Number(uid);

  const user = await loadUser(uidNum);
  if (!user) notFound();

  // 聚合种子统计：累计上传 / 累计下载
  const agg = await query<{
    total_uploaded: string | number | null;
    total_downloaded: string | number | null;
  }>(
    `SELECT
       COALESCE(SUM(uploaded), 0)   AS total_uploaded,
       COALESCE(SUM(downloaded), 0) AS total_downloaded
     FROM public.user_torrent_stats WHERE user_email = $1`,
    [user.email],
  );

  const uploaded = Number(agg[0]?.total_uploaded ?? 0);
  const downloaded = Number(agg[0]?.total_downloaded ?? 0);
  const shareRatio = downloaded > 0 ? uploaded / downloaded : uploaded > 0 ? 999.99 : 0;

  const stats: UserStats = {
    magic: Number(user.wish_magic) || 0,
    seedPoints: Number(user.seed_points) || 0,
    uploaded,
    downloaded,
    shareRatio,
  };

  const session = await auth();
  const isOwner = session.user.email === user.email;

  return isOwner ? (
    <OwnerProfile user={user} stats={stats} />
  ) : (
    <GuestProfile user={user} stats={stats} />
  );
}

/* ============================================================
   内部共享小组件（头像横幅、统计卡片）
   ============================================================ */

export function ProfileBanner({
  user,
  topRight,
  actions,
  stats,
  aside,
}: {
  user: Row;
  topRight?: React.ReactNode;
  actions?: React.ReactNode;
  stats?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  const nickname = profileNickname(user);
  const hasAvatar = !!user.avatar_url;
  const rainbow = isRainbowName(user);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="h-28 bg-gradient-to-r from-brand-100 via-brand-50 to-brand-100" />

      {topRight && <div className="absolute right-6 top-4">{topRight}</div>}

      <div className="px-6 pb-6">
        <div
          className={
            aside
              ? "min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] min-[900px]:gap-x-6"
              : ""
          }
        >
          <div className="-mt-12 mb-4 min-[900px]:col-span-2">
            <span className="inline-flex rounded-full bg-gradient-to-tr from-brand-400 via-brand-500 to-brand-600 p-[3px] shadow-lg shadow-brand-200">
              {hasAvatar ? (
                <Image
                  src={user.avatar_url!}
                  alt={nickname}
                  width={96}
                  height={96}
                  unoptimized
                  className="size-24 rounded-full border-4 border-white object-cover"
                />
              ) : (
                <span className="grid size-24 place-items-center rounded-full border-4 border-white bg-slate-100 text-3xl font-bold text-slate-500">
                  {nickname[0]?.toUpperCase() ?? "U"}
                </span>
              )}
            </span>
          </div>

          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              <UserName name={nickname} rainbow={rainbow} />
              <RoleBadge role={user.role} />
            </h1>
            <p className="mt-1 text-[13px] text-slate-400">
              加入于 {new Date(user.created_at).toLocaleDateString("zh-CN")}
            </p>

            {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
            {stats && <div className="mt-5 flex flex-wrap gap-6 text-sm">{stats}</div>}
          </div>

          {aside && (
            <div className="mt-5 min-w-0 min-[900px]:mt-0 min-[900px]:flex min-[900px]:items-center min-[900px]:self-stretch min-[900px]:border-l min-[900px]:border-slate-100 min-[900px]:pl-6">
              {aside}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  const toneClass = tone ?? "text-slate-900";
  return (
    <div>
      <span className={`font-semibold tabular-nums ${toneClass}`}>{value}</span>
      <span className="ml-1 text-[12px] text-slate-500">{label}</span>
    </div>
  );
}

/** 字节数格式化为自动单位（B/KB/MB/GB/TB） */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  const val = n >= 100 ? n.toFixed(1) : n.toFixed(2);
  return `${Number(val).toLocaleString("en-US")} ${units[i]}`;
}

/** 字节数拆成数值与单位（"328.42 GB" → 328.42 / GB），便于紧凑排版 */
export function splitBytes(bytes: number): { value: string; unit: string } {
  const [value, unit = ""] = formatBytes(bytes).split(" ");
  return { value, unit };
}

/** 整数千分位分隔 */
export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export type { Row as UserRow };
