import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Scale, Sparkles, Star } from "lucide-react";
import { ProfileBanner, fmtInt, splitBytes } from "./page";
import type { UserRow, UserStats } from "./page";
import { ProfileStatsInline, type StatMetric } from "./ProfileStats";

export default async function OwnerProfile({ user, stats }: { user: UserRow; stats: UserStats }) {
  const shareRatioText = stats.shareRatio >= 999 ? "∞" : stats.shareRatio.toFixed(2);
  const uploaded = splitBytes(stats.uploaded);
  const downloaded = splitBytes(stats.downloaded);

  const metrics: StatMetric[] = [
    { icon: Scale, label: "分享率", value: shareRatioText, unit: "", iconClass: "text-slate-400" },
    {
      icon: ArrowUpRight,
      label: "累计上传",
      value: uploaded.value,
      unit: uploaded.unit,
      iconClass: "text-emerald-500",
    },
    {
      icon: ArrowDownRight,
      label: "累计下载",
      value: downloaded.value,
      unit: downloaded.unit,
      iconClass: "text-sky-500",
    },
    {
      icon: Star,
      label: "做种积分",
      value: fmtInt(stats.seedPoints),
      unit: "",
      iconClass: "text-yellow-500",
    },
    {
      icon: Sparkles,
      label: "魔力值",
      value: fmtInt(stats.magic),
      unit: "",
      iconClass: "text-violet-500",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <ProfileBanner
        user={user}
        aside={<ProfileStatsInline metrics={metrics} />}
        topRight={
          <Link
            href="/settings"
            className="flex items-center gap-1.5 rounded-full border border-white/60 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-3.5">
              <path
                d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            控制面板
          </Link>
        }
      />
    </div>
  );
}

/**
 * 职位 badge — 4 级优先级
 * admin > staff > vip > user
 */
export function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case "admin":
      return (
        <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600 ring-1 ring-inset ring-amber-500/30 align-middle">
          👑 站长
        </span>
      );
    case "staff":
      return (
        <span className="ml-2 inline-flex items-center rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-600 ring-1 ring-inset ring-rose-500/30 align-middle">
          ⚡ 管理员
        </span>
      );
    case "vip":
      return (
        <span className="ml-2 inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-600 ring-1 ring-inset ring-violet-500/30 align-middle">
          💎 贵宾
        </span>
      );
    default:
      return (
        <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-inset ring-slate-200 align-middle">
          用户
        </span>
      );
  }
}
