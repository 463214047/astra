"use client";

import { useState } from "react";

const DEFAULT_ADMIN = "support@astra.community";

export default function ContactForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<null | { ok: boolean; msg: string }>(null);

  async function submit() {
    if (!title.trim()) return setStatus({ ok: false, msg: "请填写标题" });

    const content =
      `${title.trim()}${body.trim() ? `\n\n${body.trim()}` : ""}`.slice(0, 2000);

    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: DEFAULT_ADMIN, content }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus({ ok: true, msg: "已送达，管理会尽快处理。可在「消息」里查看回复。" });
        setTitle("");
        setBody("");
      } else {
        setStatus({ ok: false, msg: data.message ?? "发送失败" });
      }
    } catch {
      setStatus({ ok: false, msg: "网络错误，请稍后重试" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
   
 
      {/* 标题 */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-500">标题</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
   
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        />
      </div>

      {/* 正文 */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-500">
          正文 
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
        
   
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        />

      </div>

      {/* 状态反馈 */}
      {status && (
        <div
          className={`rounded-lg px-3 py-2 text-xs ${
            status.ok
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {status.msg}
        </div>
      )}

      {/* 底部按钮 */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "发送中…" : "发送"}
        </button>
      </div>
    </div>
  );
}
