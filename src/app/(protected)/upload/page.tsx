// src/app/(protected)/upload/page.tsx — 布局优化版
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, ChevronDown, Save, Send, ShieldAlert, ShieldCheck } from "lucide-react";
import Editor from "@/components/editor";
import { parseTorrentTotalSize } from "@/lib/bencode";
import { extractTmdbRef } from "@/lib/tmdb-link";
import { parseExternalLinks, type ExternalLink } from "@/lib/external-links";
import { tagStyle } from "@/lib/tags";

type Category = "游戏" | "漫画" | "动漫" | "电影" | "剧集" | "音乐" | "体育" | "综艺";

const CATEGORIES: { key: Category; style: string }[] = [
  { key: "游戏", style: "bg-blue-600 text-white" },
  { key: "漫画", style: "bg-emerald-600 text-white" },
  { key: "动漫", style: "bg-violet-600 text-white" },
  { key: "电影", style: "bg-amber-500 text-white" },
  { key: "剧集", style: "bg-rose-500 text-white" },
  { key: "音乐", style: "bg-cyan-600 text-white" },
  { key: "体育", style: "bg-lime-600 text-white" },
  { key: "综艺", style: "bg-fuchsia-500 text-white" },
];

// 预置标签（多选，配色与详情页/列表共用 src/lib/tags.ts）
const PRESET_TAGS: { key: string; style: string }[] = [
  "禁转",
  "LGBTQ+",
  "特效字幕",
  "中字",
  "合集",
].map((key) => ({ key, style: tagStyle(key) }));

const NSFW_TAGS: { key: string; style: string }[] = ["无码", "NTR"].map((key) => ({
  key,
  style: tagStyle(key),
}));
const NSFW_TAG_KEYS = new Set(NSFW_TAGS.map((t) => t.key));

function switchAdult(
  v: boolean,
  setIsAdult: (v: boolean) => void,
  setTags: React.Dispatch<React.SetStateAction<string[]>>,
) {
  setIsAdult(v);
  if (!v) setTags((prev) => prev.filter((t) => !NSFW_TAG_KEYS.has(t)));
}

// 从编辑器 HTML 内容中提取第一张图片 URL（兼容 HTML <img> 和 Markdown ![](url)）
function extractFirstImage(content: string): string | null {
  if (!content) return null;
  const htmlMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (htmlMatch) return htmlMatch[1];
  const mdMatch = content.match(/!\[[^\]]*\]\(([^)]+)\)/);
  if (mdMatch) return mdMatch[1];
  return null;
}

function formatTorrentSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function UploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [mediainfo, setMediainfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);
  const [editError, setEditError] = useState("");
  const [isAdult, setIsAdult] = useState(false);
  const [tmdbLink, setTmdbLink] = useState("");
  const [otherLinks, setOtherLinks] = useState<ExternalLink[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [rulesAgreed, setRulesAgreed] = useState(true);
  const [torrentName, setTorrentName] = useState("");
  const [torrentSize, setTorrentSize] = useState(0);
  const [torrentBase64, setTorrentBase64] = useState(""); // 后端用 bencode 解析兜底
  const [submitResult, setSubmitResult] = useState<
    { ok: true; id: string } | { ok: false; message: string } | null
  >(null);

  // =========== 编辑模式：加载原帖 ===========
  useEffect(() => {
    if (!editId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/posts/${editId}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok || !data.ok || !data.item) {
          setEditError(data.message || "加载帖子失败");
          setLoadingEdit(false);
          return;
        }

        const p = data.item;
        setTitle(p.title ?? "");
        setSubtitle(p.subtitle ?? "");
        setContent(p.content ?? "");
        setCategory((p.category as Category) ?? null);
        setTags(p.tags ?? []);
        setAnonymous(Boolean(p.anonymous));
        setIsAdult(Boolean(p.is_adult));

        // 外链：TMDB 回填到专用输入框，其他外链（豆瓣等）原样保留
        const links = parseExternalLinks(p.external_link ?? null);
        setTmdbLink(links.find((l) => extractTmdbRef(l.url))?.url ?? "");
        setOtherLinks(links.filter((l) => !extractTmdbRef(l.url)));

        if (p.torrent_name) {
          setTorrentName(p.torrent_name);
          setTorrentSize(p.torrent_size ?? 0);
          setTorrentBase64(""); // 编辑模式下没重新选种子，留空给后端表示"不变"
        }

        // MediaInfo
        if (p.mediainfo) {
          setMediainfo(String(p.mediainfo));
        }

        setEditing(true);
      } catch {
        if (!cancelled) {
          setEditError("网络错误");
        }
      } finally {
        if (!cancelled) setLoadingEdit(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editId]);

  const [catOpen, setCatOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!catOpen) return;
    const onDown = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCatOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [catOpen]);

  // TMDB 链接：空视为合法（选填）；填了就必须能解析出 movie / tv
  const tmdbRef = extractTmdbRef(tmdbLink);
  const tmdbLinkValid = tmdbLink.trim() === "" || tmdbRef !== null;
  const externalLinks: ExternalLink[] = [
    ...otherLinks,
    ...(tmdbRef && tmdbLink.trim() ? [{ name: "TMDB", url: tmdbLink.trim() }] : []),
  ];

  const canSubmit =
    title.trim().length > 0 && category !== null && rulesAgreed && tmdbLinkValid && !submitting;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        content,
        mediainfo: mediainfo.trim() || null,
        external_link: externalLinks,
        category,
        tags,
        cover_url: extractFirstImage(content),
        anonymous,
        rules_agreed: rulesAgreed,
        is_adult: isAdult,
        torrent: torrentName ? { name: torrentName, size: torrentSize, data: torrentBase64 } : null,
      };

      const url = editing ? `/api/posts/${editId}` : "/api/posts";
      const method = editing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({ ok: false, message: "响应解析失败" }));

      if (!res.ok || !data.ok) {
        setSubmitResult({
          ok: false,
          message: data.message || (editing ? "保存失败" : "发布失败"),
        });
        // 失败也不解锁 — 按钮一直灰，防止连点重复提交；用户看完错误刷新页面重试
        return;
      }

      // 成功 → 跳转离开页面
      router.push(`/posts/${data.id ?? editId}`);
    } catch (err) {
      console.error(err);
      setSubmitResult({ ok: false, message: "网络错误，请检查连接后重试" });
      // 网络错误也保持灰色，避免用户连续触发请求
    }
  }

  // =========== UI ===========
  if (loadingEdit) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center">
        <p className="text-sm text-slate-500">加载中…</p>
      </div>
    );
  }

  if (editError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center">
        <p className="text-sm text-rose-500">{editError}</p>
        <Link href="/" className="mt-3 inline-block text-xs text-slate-500 hover:text-slate-900">
          返回首页
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="space-y-5">
        <Card
          section={editing ? "编辑作品" : "发布"}
          icon="📝"
          headerRight={
            <button
              type="button"
              onClick={() => switchAdult(!isAdult, setIsAdult, setTags)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                isAdult
                  ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200 hover:bg-rose-100"
                  : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
              }`}
            >
              {isAdult ? (
                <ShieldAlert size={14} strokeWidth={2.25} />
              ) : (
                <ShieldCheck size={14} strokeWidth={2.25} />
              )}
              {isAdult ? "NSFW" : "SFW"}
            </button>
          }
          footer={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
                <label
                  htmlFor="rules-agreed"
                  className="group inline-flex cursor-pointer select-none items-center gap-2.5 text-sm text-slate-600 transition hover:text-slate-900"
                >
                  <input
                    id="rules-agreed"
                    type="checkbox"
                    checked={rulesAgreed}
                    onChange={(e) => setRulesAgreed(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span className="grid size-[18px] shrink-0 place-items-center rounded-md border border-slate-300 bg-white transition-all group-hover:border-slate-400 peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/20 peer-focus-visible:ring-offset-2">
                    {rulesAgreed && <Check size={12} strokeWidth={3} className="text-white" />}
                  </span>
                  我已阅读
                </label>
                <Link
                  href="/rules"
                  target="_blank"
                  className="text-sm font-medium text-brand-700 underline-offset-2 hover:text-brand-800 hover:underline"
                >
                  上传规则
                </Link>
                <span className="text-sm text-rose-500">*</span>
              </div>

              <button
                type="button"
                disabled={!canSubmit || submitting}
                onClick={handleSubmit}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-2 active:scale-[0.98] sm:w-auto sm:min-w-[8.5rem] ${
                  submitting
                    ? "cursor-wait bg-brand-600 text-white shadow-lg shadow-brand-600/20"
                    : canSubmit
                      ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20 hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-600/30"
                      : "cursor-not-allowed bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200"
                }`}
              >
                {submitting ? (
                  <>
                    <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {editing ? "保存中…" : "发布中…"}
                  </>
                ) : (
                  <>
                    {editing ? (
                      <Save className="size-4" strokeWidth={2} />
                    ) : (
                      <Send className="size-4" strokeWidth={2} />
                    )}
                    {editing ? "保存修改" : "立即发布"}
                  </>
                )}
              </button>
            </div>
          }
        >
          <div className="space-y-5">
            {/* 种子文件 */}
            <Field label="种子文件" hint="可选">
              {torrentName ? (
                <div className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50/80 to-white px-4 py-3 transition-all hover:border-slate-300 hover:shadow-sm">
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-base ring-1 ring-inset ring-slate-200">
                      📀
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{torrentName}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatTorrentSize(torrentSize)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTorrentName("");
                      setTorrentSize(0);
                      setTorrentBase64("");
                    }}
                    className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 transition hover:bg-rose-50 hover:text-rose-600 hover:ring-rose-200 active:scale-[0.96]"
                  >
                    移除
                  </button>
                </div>
              ) : (
                <label className="group flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 transition-all hover:border-slate-300 hover:bg-slate-50">
                  <input
                    type="file"
                    accept=".torrent"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (!f.name.toLowerCase().endsWith(".torrent")) {
                        alert("仅支持 .torrent 文件");
                        return;
                      }
                      setTorrentName(f.name);
                      const reader = new FileReader();
                      reader.onload = () => {
                        try {
                          const arr = new Uint8Array(reader.result as ArrayBuffer);
                          const total = parseTorrentTotalSize(arr);
                          setTorrentSize(Number(total ?? f.size));
                          const bin = Array.from(arr, (b) => String.fromCharCode(b)).join("");
                          setTorrentBase64(btoa(bin));
                        } catch {
                          setTorrentSize(f.size);
                        }
                      };
                      reader.readAsArrayBuffer(f);
                    }}
                  />
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-base ring-1 ring-inset ring-slate-200 transition group-hover:-translate-y-0.5">
                    📀
                  </span>
                  <span className="text-sm font-medium text-slate-800 group-hover:text-slate-900">
                    点击选择 .torrent 文件
                  </span>
                </label>
              )}
            </Field>

            {/* 标题 */}
            <Field label="标题" required>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
              />
            </Field>

            {/* 副标题 */}
            <Field label="副标题">
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
              />
            </Field>
            {/* TMDB 链接 */}
            <Field label="TMDB 链接">
              <div>
                <input
                  type="text"
                  value={tmdbLink}
                  onChange={(e) => setTmdbLink(e.target.value)}

                  className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
                />
                {tmdbLink.trim() !== "" && (
                  <p
                    className={`mt-1.5 text-xs ${tmdbLinkValid ? "text-emerald-600" : "text-rose-500"}`}
                  >
                    {tmdbRef
                      ? `已识别 TMDB ${tmdbRef.mediaType === "tv" ? "剧集" : "电影"} #${tmdbRef.id}，详情页将展示作品介绍`
                      : "不是有效的 TMDB 链接（应为 themoviedb.org 的 movie / tv 页面）"}
                  </p>
                )}
              </div>
            </Field>
            {/* 介绍（正文编辑器）*/}
            <Field label="介绍">
              <div className="rounded-2xl transition focus-within:ring-4 focus-within:ring-slate-900/5">
                <Editor content={content} onChange={setContent} minimal />
              </div>
            </Field>
            {/* MediaInfo */}
            <Field label="MediaInfo">
              <textarea
                rows={8}
                value={mediainfo}
                onChange={(e) => setMediainfo(e.target.value)}
                placeholder="请粘贴 Mediainfo / BDInfo 解析的信息（英语并且是 text 格式）"
                className="block w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-xs leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
              />
            </Field>
            {/* 分类 */}
            <Field label="分类" required>
              <div ref={catRef} className="relative md:w-1/4">
                <button
                  type="button"
                  onClick={() => setCatOpen((o) => !o)}
                  className={`flex w-full items-center justify-between rounded-xl border bg-white px-4 py-2.5 pr-10 text-left text-sm transition outline-none ${
                    catOpen
                      ? "border-slate-400 ring-4 ring-slate-900/5"
                      : category
                        ? "border-slate-200 text-slate-900 hover:border-slate-300"
                        : "border-slate-200 text-slate-400 hover:border-slate-300"
                  }`}
                >
                  {category ?? "请选择分类"}
                  <ChevronDown
                    size={16}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform duration-200 ${catOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {catOpen && (
                  <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/10">
                    {CATEGORIES.map((c) => {
                      const active = category === c.key;
                      return (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => {
                            setCategory(c.key);
                            setCatOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                            active
                              ? `${c.style} shadow-sm`
                              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                        >
                          {c.key}
                          {active && <Check size={14} strokeWidth={3} className="ml-auto" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </Field>

            {/* 标签 */}
            <Field label="标签">
              <div className="-mx-1 flex flex-wrap gap-2 px-1 pb-1">
                {PRESET_TAGS.map((t) => {
                  const selected = tags.includes(t.key);
                  return (
                    <TagChip
                      key={t.key}
                      tag={t}
                      selected={selected}
                      onToggle={() => {
                        setTags((prev) =>
                          selected ? prev.filter((x) => x !== t.key) : [...prev, t.key],
                        );
                      }}
                    />
                  );
                })}
                {isAdult &&
                  NSFW_TAGS.map((t) => {
                    const selected = tags.includes(t.key);
                    return (
                      <TagChip
                        key={t.key}
                        tag={t}
                        selected={selected}
                        onToggle={() => {
                          setTags((prev) =>
                            selected ? prev.filter((x) => x !== t.key) : [...prev, t.key],
                          );
                        }}
                      />
                    );
                  })}
              </div>
            </Field>

            {/* 提交结果反馈 */}
            {submitResult && (
              <div
                role="status"
                className={`rounded-xl border px-4 py-3 text-sm ${
                  submitResult.ok
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {submitResult.ok ? (
                  <>
                    ✅ 发布成功！
                    <code className="mx-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-mono">
                      {submitResult.id.slice(0, 8)}…
                    </code>
                  </>
                ) : (
                  <>❌ {submitResult.message}</>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============== 小组件 ==============

function Card({
  section,
  icon,
  children,
  headerRight,
  footer,
}: {
  section: string;
  icon: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
        <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 text-sm ring-1 ring-inset ring-slate-200">
          {icon}
        </span>
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{section}</h2>
        {headerRight && <div className="ml-auto">{headerRight}</div>}
      </div>
      {/* 内容 */}
      <div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>
      {/* 底部操作栏 */}
      {footer && (
        <div className="rounded-b-2xl border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
          {footer}
        </div>
      )}
    </section>
  );
}

function TagChip({
  tag,
  selected,
  onToggle,
}: {
  tag: { key: string; style: string };
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition-all duration-200 active:scale-[0.96] ${
        selected
          ? `${tag.style} shadow-sm`
          : "bg-slate-50 text-slate-600 ring-slate-200 hover:-translate-y-0.5 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {tag.key}
    </button>
  );
}

type CounterState = "normal" | "warn" | "error";

function Field({
  label,
  hint,
  required,
  counter,
  counterState,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  counter?: string;
  counterState?: CounterState;
  children: React.ReactNode;
}) {
  const counterColor =
    counterState === "error"
      ? "text-rose-500"
      : counterState === "warn"
        ? "text-amber-500"
        : "text-slate-400";

  return (
    <div className="flex flex-col gap-1.5 md:flex-row md:items-start md:gap-4">
      {/* 左侧 label 区 — 桌面端固定宽度对齐 */}
      <div className="flex items-baseline justify-between gap-3 md:w-28 md:shrink-0 md:justify-end md:pt-1.5">
        <label className="text-sm font-medium leading-6 text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
          {hint && <span className="ml-1.5 text-xs font-normal text-slate-400">{hint}</span>}
        </label>
        {counter && (
          <span className={`shrink-0 text-xs tabular-nums md:hidden ${counterColor}`}>
            {counter}
          </span>
        )}
      </div>
      {/* 右侧输入区 */}
      <div className="min-w-0 flex-1">{children}</div>
      {/* 桌面端 counter 放在最右侧 */}
      {counter && (
        <span className={`hidden shrink-0 text-xs tabular-nums md:block ${counterColor}`}>
          {counter}
        </span>
      )}
    </div>
  );
}
