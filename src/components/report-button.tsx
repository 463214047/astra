"use client";

import { useState } from "react";

type Props = {
  postId: string;
};

export default function ReportButton({ postId }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!reason.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setDone(true);
        setTimeout(() => {
          setOpen(false);
          setDone(false);
          setReason("");
        }, 1500);
      } else {
        alert(data.message ?? "举报失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-rose-500"
        title="举报"
      >
        <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
          <path
            d="M4 3h9l3 3v11H4V3ZM7 9h6M7 12h4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        举报
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <div className="py-6 text-center">
                <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  ✓
                </div>
                <p className="text-sm font-medium text-slate-800">举报已提交</p>
                <p className="mt-1 text-xs text-slate-500">感谢你的反馈</p>
              </div>
            ) : (
              <>
                <h3 className="text-base font-semibold text-slate-900">举报此内容</h3>
                <p className="mt-1 text-xs text-slate-500">请描述举报原因，我们会尽快处理</p>

                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="请填写举报原因（最多 500 字）"
                  rows={4}
                  disabled={submitting}
                  className="mt-4 w-full resize-none rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs outline-none transition focus:border-slate-400 focus:bg-white disabled:opacity-60"
                />

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                    className="rounded-full px-4 py-1.5 text-xs text-slate-500 hover:text-slate-900 disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={submit}
                    disabled={!reason.trim() || submitting}
                    className="rounded-full bg-rose-500 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {submitting ? "提交中…" : "提交举报"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
