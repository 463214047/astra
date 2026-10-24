"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, ShieldAlert, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SearchInput() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [advOpen, setAdvOpen] = useState(false);
  const [advScope, setAdvScope] = useState<string | null>(null);
  const [advCategory, setAdvCategory] = useState<string | null>(null);
  const [advTag, setAdvTag] = useState<string | null>(null);
  const [advContent, setAdvContent] = useState<"torrent" | "forum">("torrent");
  const [advSeeded, setAdvSeeded] = useState(true);
  const [advAdult, setAdvAdult] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 切内容类型时清空只对 torrent 有意义的筛选
  function switchContent(v: "torrent" | "forum") {
    setAdvContent(v);
  }

  // 点击外部关闭高级搜索
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setAdvOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function submit() {
    const term = query.trim();
    const params = new URLSearchParams();
    if (term) params.set("q", term);
    if (advScope) params.set("scope", advScope);
    if (advCategory) params.set("category", advCategory);
    if (advTag) params.set("tags", advTag);
    if (advContent !== "torrent") params.set("content", advContent);
    if (advSeeded) params.set("seeded", "1");
    if (advAdult) params.set("adult", "1");
    const anyFilter =
      !!term || !!advScope || !!advCategory || !!advTag ||
      (advContent !== "torrent") || advSeeded || advAdult;
    if (!anyFilter) return;
    setAdvOpen(false);
    router.push(`/search?${params.toString()}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      setAdvOpen(false);
    }
  }

  // ---------- 固定的筛选项集合 ----------
  const TORRENT_CATEGORIES = [
    { label: "游戏",   emoji: "🎮" },
    { label: "漫画",   emoji: "📚" },
    { label: "动漫",   emoji: "🎬" },
    { label: "电影",   emoji: "🎥" },
    { label: "剧集", emoji: "📺" },
    { label: "音乐",   emoji: "🎵" },
    { label: "体育",   emoji: "⚽" },
    { label: "综艺",   emoji: "🎤" },
  ] as const;

  const TORRENT_TAGS = [
    { label: "禁转",     emoji: "🚫" },
    { label: "LGBTQ+",   emoji: "🏳️‍🌈" },
    { label: "特效字幕", emoji: "✨" },
    { label: "中字",     emoji: "🀄" },
    { label: "合集",     emoji: "📦" },
  ] as const;

  const NSFW_TAG_SET = new Set(["无码", "NTR"]);

  const TORRENT_NSFW_TAGS = [
    { label: "无码", emoji: "🔞" },
    { label: "NTR",  emoji: "⚠️" },
  ] as const;

  function switchAdult(v: boolean) {
    setAdvAdult(v);
    if (!v && advTag && NSFW_TAG_SET.has(advTag)) setAdvTag(null);
  }

  const FORUM_TAGS = [
    { label: "求助", emoji: "🆘" },
    { label: "分享", emoji: "💡" },
    { label: "邀请", emoji: "📩" },
    { label: "讨论", emoji: "💬" },
    { label: "公告", emoji: "📢" },
  ] as const;

  const TORRENT_SCOPE = [
    { icon: "📀", label: "我的发布", value: "mine" },
    { icon: "💾", label: "我的做种", value: "seeded" },
    { icon: "⭐", label: "我的收藏", value: "favorites" },
  ] as const;

  const FORUM_SCOPE = [
    { icon: "📀", label: "我的发布", value: "mine" },
    { icon: "⭐", label: "我的收藏", value: "favorites" },
  ] as const;

  const SCOPE = advContent === "forum" ? FORUM_SCOPE : TORRENT_SCOPE;
  const SCOPE_TITLE = advContent === "forum" ? "过滤范围" : "种子范围";

  return (
    <div ref={wrapRef} className="relative w-full min-w-0 max-w-md">
      {/* 搜索框 */}
      <div className="relative">
        {/* 左侧可点击放大镜 */}
        <button type="button" onClick={submit} aria-label="搜索"
          className="absolute left-2.5 top-1/2 grid size-5 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-slate-400 transition hover:text-slate-700">
          <svg viewBox="0 0 20 20" fill="none" className="size-4">
            <path d="M9 3a6 6 0 1 0 3.7 10.7l3.3 3.3a1 1 0 0 0 1.4-1.4l-3.3-3.3A6 6 0 0 0 9 3Zm-4 6a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" fill="currentColor" />
          </svg>
        </button>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="搜索…"
          aria-label="搜索"
          className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-16 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
        />

        {/* 清空按钮（有值时才显） */}
        {query && (
          <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            aria-label="清空"
            className="absolute right-9 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600">
            <svg viewBox="0 0 16 16" fill="none" className="size-3.5">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {/* 右侧高级搜索按钮（打开时加深背景提示激活态） */}
        <button type="button" onClick={() => setAdvOpen((v) => !v)} aria-label="高级搜索"
          aria-expanded={advOpen}
          className={`absolute right-2 top-1/2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-full transition ${advOpen ? "bg-slate-200 text-slate-700" : "text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"}`}>
          <SlidersHorizontal size={16} strokeWidth={1.8} />
        </button>
      </div>

      {/* 高级搜索下拉卡片（过滤器） — 横向长方形 */}
      {advOpen && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/[0.08]"
          onMouseDown={(e) => {
            // 阻止点击面板内部时被 document.mousedown 关闭
            // 但原生 <select> 依赖 mousedown 默认行为展开下拉，跳过它
            const t = e.target as HTMLElement;
            if (t.closest("select")) return;
            e.preventDefault();
          }}
        >
          <div className="space-y-3 p-4">
            {/* 内容类型 */}
            <Field label="内容">
              <select
                value={advContent}
                onChange={(e) => switchContent(e.target.value as "torrent" | "forum")}
                className="block w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              >
                <option value="torrent">种子</option>
                <option value="forum">论坛</option>
              </select>
            </Field>

            {/* 范围 */}
            <Field label={SCOPE_TITLE}>
              <select
                value={advScope ?? ""}
                onChange={(e) => setAdvScope((e.target.value || null) as string | null)}
                className="block w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              >
                <option value="">不限</option>
                {SCOPE.map((it) => (
                  <option key={it.value} value={it.value}>{it.label}</option>
                ))}
              </select>
            </Field>

            {/* 分类（torrent 时显示种子分类，forum 时隐藏） */}
            {advContent === "torrent" && (
              <Field label="分类">
                <select
                  value={advCategory ?? ""}
                  onChange={(e) => setAdvCategory((e.target.value || null) as string | null)}
                  className="block w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">不限</option>
                  {TORRENT_CATEGORIES.map((c) => (
                    <option key={c.label} value={c.label}>{c.label}</option>
                  ))}
                </select>
              </Field>
            )}

            {/* 标签（torrent 种子标签 / forum 论坛标签） */}
            <Field label="标签">
              <select
                value={advTag ?? ""}
                onChange={(e) => setAdvTag((e.target.value || null) as string | null)}
                className="block w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              >
                <option value="">不限</option>
                {(advContent === "torrent" ? TORRENT_TAGS : FORUM_TAGS).map((t) => (
                  <option key={t.label} value={t.label}>{t.label}</option>
                ))}
                {advContent === "torrent" && advAdult && (
                  <optgroup label="NSFW">
                    {TORRENT_NSFW_TAGS.map((t) => (
                      <option key={t.label} value={t.label}>{t.label}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </Field>

            {/* 开关 — 种子时两个都显示，论坛时隐藏 */}
            {advContent === "torrent" && (
              <div className="flex items-center gap-6 pt-1">
                <Toggle label="只看做种中" checked={advSeeded} onChange={setAdvSeeded} />
                <button
                  type="button"
                  onClick={() => switchAdult(!advAdult)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                    advAdult
                      ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200 hover:bg-rose-100"
                      : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  {advAdult ? <ShieldAlert size={14} strokeWidth={2.25} /> : <ShieldCheck size={14} strokeWidth={2.25} />}
                  {advAdult ? "NSFW" : "SFW"}
                </button>
              </div>
            )}
          </div>

          {/* 底部按钮 */}
          <div className="border-t border-slate-100 px-4 py-2">
            <button type="button" onClick={submit}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700">
              搜索{query ? ` "${query.trim()}"` : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="group inline-flex cursor-pointer items-center gap-2 select-none">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
          checked ? "bg-slate-900" : "bg-slate-200 group-hover:bg-slate-300"
        }`}
      >
        <span
          className={`inline-block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
      <span className="text-xs text-slate-600 group-hover:text-slate-900">{label}</span>
    </label>
  );
}
