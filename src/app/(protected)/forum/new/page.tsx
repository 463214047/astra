"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Editor from "@/components/editor";

type TopicTag = "求助" | "邀请" | "分享" | "讨论" | "公告";

const TAG_OPTIONS: { key: TopicTag; style: string }[] = [
  { key: "求助", style: "bg-blue-50 text-blue-700 ring-blue-200" },
  { key: "分享", style: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { key: "邀请", style: "bg-violet-50 text-violet-700 ring-violet-200" },
  { key: "讨论", style: "bg-amber-50 text-amber-700 ring-amber-200" },
  { key: "公告", style: "bg-rose-50 text-rose-700 ring-rose-200" },
];

const MAX_TITLE = 80;
const MAX_CONTENT = 5000;

export default function ForumNewPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tag, setTag] = useState<TopicTag | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = title.trim().length > 0 && tag !== null && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content,
          category: tag,
          post_type: "forum",
          rules_agreed: true,
          torrent: null,
        }),
      });
      const data = await res.json().catch(() => ({ ok: false, message: "响应解析失败" }));
      if (!res.ok || !data.ok) {
        setError(data.message || "发帖失败");
        return;
      }
      router.push(`/forum/${data.id}`);
    } catch {
      setError("网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          发新帖
        </h1>
        <p className="mt-1 text-sm text-slate-500">写下你的想法，让同好们看到</p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] sm:p-6 space-y-6">
        {/* 标题 */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label className="text-sm font-medium text-slate-700">
              标题 <span className="text-rose-500">*</span>
            </label>
            <span className={`text-xs tabular-nums ${
              title.length > MAX_TITLE ? "text-rose-500" :
              title.length >= MAX_TITLE * 0.8 ? "text-amber-500" : "text-slate-400"
            }`}>{title.length}/{MAX_TITLE}</span>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
  
            className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
          />
        </div>

        {/* Tag */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            分类 <span className="text-rose-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map((t) => {
              const active = tag === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTag(active ? null : t.key)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition-all active:scale-95 ${
                    active
                      ? `${t.style} shadow-sm`
                      : "bg-slate-50 text-slate-600 ring-slate-200 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {t.key}
                </button>
              );
            })}
          </div>
        </div>

        {/* 正文 */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label className="text-sm font-medium text-slate-700">
              正文 <span className="text-rose-500">*</span>
            </label>
            <span className={`text-xs tabular-nums ${
              content.length > MAX_CONTENT ? "text-rose-500" : "text-slate-400"
            }`}>{content.length}/{MAX_CONTENT}</span>
          </div>
          <div className="rounded-xl border border-slate-200 overflow-hidden focus-within:border-slate-400 focus-within:ring-4 focus:ring-slate-900/5 transition">
            <Editor content={content} onChange={setContent} />
          </div>
        </div>

        {/* 错误 */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* 操作行 */}
        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
          <p className="text-xs text-slate-500">发帖后可编辑，请仔细检查</p>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className={`rounded-full px-7 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
              canSubmit
                ? "bg-slate-900 text-white hover:bg-slate-700 shadow-sm shadow-slate-900/20"
                : "cursor-not-allowed bg-slate-200 text-slate-400"
            }`}
          >
            {submitting ? "提交中…" : "发帖"}
          </button>
        </div>
      </div>
    </div>
  );
}
