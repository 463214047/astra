import type { ComponentType } from "react";
import { BarChart3 } from "lucide-react";

export type StatMetric = {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  unit?: string;
  /** 图标色调，默认 slate；只做轻量点缀，不使用彩色底板 */
  iconClass?: string;
};

/**
 * 个人主页数据条。
 * 与站点其余卡片保持一致：白底、细边框、slate 文本，图标只做低饱和点缀。
 */
export default function ProfileStats({
  title,
  subtitle,
  metrics,
}: {
  title: string;
  subtitle?: string;
  metrics: StatMetric[];
}) {
  const gridClass =
    metrics.length === 4
      ? "grid-cols-2 sm:grid-cols-4"
      : "grid-cols-2 sm:grid-cols-3 md:grid-cols-5";
  const borderClass =
    metrics.length === 4 ? "sm:border-l sm:border-slate-100" : "md:border-l md:border-slate-100";
  const spanLast = metrics.length % 2 === 1;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p>}
        </div>
        <BarChart3
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-brand-400"
          strokeWidth={2}
        />
      </div>

      <div className={`grid ${gridClass}`}>
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          const last = index === metrics.length - 1;
          const span = spanLast && last;

          return (
            <div
              key={metric.label}
              className={`min-w-0 px-5 py-4 ${
                span
                  ? "col-span-2 flex items-center justify-between gap-3 border-t border-slate-100 sm:col-span-2 sm:block sm:border-t-0 md:col-span-1"
                  : ""
              } ${index > 0 ? borderClass : ""}`}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <Icon
                  className={`size-3.5 shrink-0 ${metric.iconClass ?? "text-slate-400"}`}
                  strokeWidth={2}
                />
                <span className="truncate">{metric.label}</span>
              </div>
              <div
                className={`flex items-baseline gap-1 ${span ? "mt-0 shrink-0 sm:mt-2" : "mt-2"}`}
              >
                <span className="truncate text-[20px] font-semibold leading-none tracking-tight tabular-nums text-slate-900">
                  {metric.value}
                </span>
                {metric.unit && (
                  <span className="shrink-0 text-[11px] font-medium text-slate-400">
                    {metric.unit}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** 个人主页横幅右侧的紧凑数据条（无卡片外壳） */
export function ProfileStatsInline({ metrics }: { metrics: StatMetric[] }) {
  const spanLast = metrics.length % 2 === 1;
  const wide = metrics.length >= 6;
  const five = metrics.length === 5;

  return (
    <div
      className={`grid w-full grid-cols-2 gap-x-5 gap-y-4 ${
        wide
          ? "sm:grid-cols-6 sm:gap-x-2"
          : five
            ? "sm:grid-cols-5 sm:gap-x-3"
            : "sm:grid-cols-3 md:grid-cols-5 md:gap-x-3"
      }`}
    >
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        const last = index === metrics.length - 1;
        const span = spanLast && last;
        const spanClass = span
          ? five
            ? "col-span-2 sm:col-span-1"
            : "col-span-2 md:col-span-1"
          : "";

        return (
          <div key={metric.label} className={`min-w-0 ${spanClass}`}>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              <Icon
                className={`size-3.5 shrink-0 ${metric.iconClass ?? "text-slate-400"}`}
                strokeWidth={2}
              />
              <span className="truncate">{metric.label}</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="truncate text-[18px] font-semibold leading-none tracking-tight tabular-nums text-slate-900">
                {metric.value}
              </span>
              {metric.unit && (
                <span className="shrink-0 text-[11px] font-medium text-slate-400">
                  {metric.unit}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
