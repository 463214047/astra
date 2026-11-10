"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";

type LinkPickerDialogProps = {
  title?: string;
  onClose: () => void;
  /** 返回链接标题与最终地址；抛出 Error 可在弹窗内展示错误并保持打开 */
  onConfirm: (payload: { title: string; href: string }) => void | Promise<void>;
};

function normalizeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith("//")) {
    const candidate = `https:${value}`;
    try {
      new URL(candidate);
      return candidate;
    } catch {
      return null;
    }
  }

  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(value)) {
    if (/^https?:\/\//i.test(value)) {
      try {
        new URL(value);
      } catch {
        return null;
      }
    }
    return value;
  }

  // 拒绝 javascript: / data: 等非预期协议
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;

  const candidate = `https://${value}`;
  try {
    new URL(candidate);
    return candidate;
  } catch {
    return null;
  }
}

export default function LinkPickerDialog({
  title = "插入链接",
  onClose,
  onConfirm,
}: LinkPickerDialogProps) {
  const [linkTitle, setLinkTitle] = useState("");
  const [href, setHref] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const titleId = useId();
  const titleInputId = useId();
  const hrefInputId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  const canSubmit = !!linkTitle.trim() && !!normalizeHref(href);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const nextTitle = linkTitle.trim();
    if (!nextTitle) {
      setError("请输入标题");
      titleRef.current?.focus();
      return;
    }

    if (!href.trim()) {
      setError("请输入链接");
      return;
    }

    const nextHref = normalizeHref(href);
    if (!nextHref) {
      setError("请输入有效的链接，如 https://example.com");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await onConfirm({ title: nextTitle, href: nextHref });
      setBusy(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请稍后重试");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy}
        tabIndex={-1}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[600px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 outline-none"
      >
        <div className="sticky top-0 z-10 flex items-center justify-center border-b border-slate-100 bg-white px-6 py-5">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label="关闭"
            className="absolute right-4 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="size-5" strokeWidth={1.8} />
          </button>
        </div>

        <form onSubmit={submit} noValidate>
          <div className="px-6 py-6">
            <label htmlFor={titleInputId} className="block text-sm font-medium text-slate-700">
              标题
            </label>
            <input
              id={titleInputId}
              ref={titleRef}
              type="text"
              value={linkTitle}
              onChange={(e) => {
                setLinkTitle(e.target.value);
                setError("");
              }}
              disabled={busy}
              maxLength={120}
              autoComplete="off"
              aria-required="true"
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-400/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            />

            <label htmlFor={hrefInputId} className="mt-5 block text-sm font-medium text-slate-700">
              链接
            </label>
            <input
              id={hrefInputId}
              type="url"
              inputMode="url"
              value={href}
              onChange={(e) => {
                setHref(e.target.value);
                setError("");
              }}
              disabled={busy}
              maxLength={2048}
              autoComplete="url"
              spellCheck={false}
              aria-required="true"
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-400/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            />

            {error && (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={busy || !canSubmit}
                className="inline-flex min-w-[88px] items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    处理中…
                  </>
                ) : (
                  "确认"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
