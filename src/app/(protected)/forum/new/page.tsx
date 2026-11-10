"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
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
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="space-y-5">
        <Card
          section="发帖"
          icon="📝"
          footer={
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!canSubmit}
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
                    发布中…
                  </>
                ) : (
                  <>
                    <Send className="size-4" strokeWidth={2} />
                    发布帖子
                  </>
                )}
              </button>
            </div>
          }
        >
          <div className="space-y-5">
            {/* 标题 */}
            <Field label="标题">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
                className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
              />
            </Field>

            {/* 分类 */}
            <Field label="分类">
              <div className="flex flex-wrap gap-2">
                {TAG_OPTIONS.map((t) => {
                  const active = tag === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTag(active ? null : t.key)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition-all duration-200 active:scale-[0.96] ${
                        active
                          ? `${t.style} shadow-sm`
                          : "bg-slate-50 text-slate-600 ring-slate-200 hover:-translate-y-0.5 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      {t.key}
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* 正文 */}
            <Field label="正文">
              <div className="rounded-2xl transition focus-within:ring-4 focus-within:ring-slate-900/5">
                <Editor content={content} onChange={setContent} />
              </div>
            </Field>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                {error}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({
  section,
  icon,
  children,
  footer,
}: {
  section: string;
  icon: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] [[data-background=tohru]_&]:bg-transparent">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
        <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 text-sm ring-1 ring-inset ring-slate-200">
          {icon}
        </span>
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{section}</h2>
      </div>
      <div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>
      {footer && (
        <div className="rounded-b-2xl border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
          {footer}
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 md:flex-row md:items-start md:gap-4">
      <label className="text-sm font-medium leading-6 text-slate-700 md:w-28 md:shrink-0 md:pt-1.5 md:text-right">
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
