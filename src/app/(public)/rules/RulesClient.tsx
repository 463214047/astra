"use client";

import { useState } from "react";
import { ScrollText, Upload, type LucideIcon } from "lucide-react";

type SectionKey = "general" | "publish";

type RuleSection = {
  key: SectionKey;
  label: string;
  icon: LucideIcon;
  items: string[];
};

const SECTIONS: RuleSection[] = [
  {
    key: "general",
    label: "总则",
    icon: ScrollText,
    items: ["为了网站能够稳定运行，请避免在被监管的公共场合提及本站。"],
  },
  {
    key: "publish",
    label: "发布规范",
    icon: Upload,
    items: [
      "转种请勿重新制种，种子内文件不要包含与资源无关的内容或广告信息。",
    ],
  },
];

const CARD =
  "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] [[data-background=tohru]_&]:bg-transparent";

export default function RulesClient() {
  const [active, setActive] = useState<SectionKey>("general");
  const section = SECTIONS.find((item) => item.key === active) ?? SECTIONS[0];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">规则</h1>
        <p className="mt-2 text-sm text-slate-500">
          请仔细阅读以下规则。违反者将视情节轻重受到警告、限制或封禁处理。
        </p>
      </header>

      <div className="grid gap-6 min-[900px]:grid-cols-[220px_minmax(0,1fr)] min-[900px]:items-start">
        <nav aria-label="规则分类" className="min-[900px]:sticky min-[900px]:top-24">
          <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm shadow-slate-900/[0.03] min-[900px]:flex-col [[data-background=tohru]_&]:bg-transparent">
            {SECTIONS.map(({ key, label, icon: Icon }) => {
              const isActive = active === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActive(key)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors min-[900px]:w-full min-[900px]:px-3.5 ${
                    isActive
                      ? "bg-brand-600 text-white shadow-sm shadow-brand-600/20"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.8} />
                  {label}
                </button>
              );
            })}
          </div>
        </nav>

        <section className={`${CARD} min-w-0 p-6 sm:p-8`}>
          <h2 className="text-xl font-semibold text-slate-900">{section.label}</h2>

          <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7 text-slate-700">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
