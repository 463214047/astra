"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Image as ImageIcon, Paperclip, X } from "lucide-react";

const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SCREENSHOTS = 5;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImageUrl(value: string): boolean {
  return /^https?:\/\/[^\s"<>]+$/i.test(value) || /^\/uploads\/[^\s"<>]+$/i.test(value);
}

type ImagePickerDialogProps = {
  title?: string;
  /** 上传接口的 kind 参数：头像 / 截图 */
  kind?: "avatar" | "screenshot";
  onClose: () => void;
  /** 返回最终图片地址（截图可多张）；抛出 Error 可在弹窗内展示错误并保持打开 */
  onConfirm: (urls: string[]) => void | Promise<void>;
};

export default function ImagePickerDialog({
  title = "插入图片",
  kind = "screenshot",
  onClose,
  onConfirm,
}: ImagePickerDialogProps) {
  const maxFiles = kind === "avatar" ? 1 : MAX_SCREENSHOTS;
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const titleId = useId();
  const urlInputId = useId();
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
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

  function selectFiles(incoming: File[]) {
    if (incoming.length === 0) return;

    const room = maxFiles - files.length;
    if (room <= 0) {
      setError(
        kind === "avatar"
          ? "只能上传 1 张图片，请先移除已选图片"
          : `最多上传 ${maxFiles} 张截图，请先移除已选截图`,
      );
      return;
    }

    const picked = incoming.slice(0, room);
    const overLimit =
      incoming.length > room
        ? kind === "avatar"
          ? "只能上传 1 张图片，已忽略多余的图片"
          : `最多上传 ${maxFiles} 张截图，已忽略多余的 ${incoming.length - room} 张`
        : "";

    const valid: File[] = [];
    let nextError = "";
    for (const next of picked) {
      if (!IMAGE_TYPES.has(next.type)) {
        nextError = nextError || "仅支持 JPG / PNG / WebP";
        continue;
      }
      if (next.size > MAX_BYTES) {
        nextError = nextError || "单张图片不能超过 5MB";
        continue;
      }
      valid.push(next);
    }

    if (valid.length > 0) {
      setFiles((prev) => [...prev, ...valid]);
      setUrl("");
      if (fileRef.current) fileRef.current.value = "";
    }
    setError(nextError || overLimit);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (incoming.length > 0) selectFiles(incoming);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const incoming = Array.from(e.dataTransfer.files ?? []);
    if (incoming.length > 0) selectFiles(incoming);
  }

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const link = url.trim();
    if (files.length === 0 && !link) {
      setError("请选择本地图片或填写图片链接");
      return;
    }
    if (files.length === 0 && !isImageUrl(link)) {
      setError("请输入 http(s) 图片链接");
      return;
    }

    setBusy(true);
    setError("");
    try {
      let urls: string[] = [];
      if (files.length > 0) {
        for (const file of files) {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch(`/api/upload?kind=${kind}`, {
            method: "POST",
            body: formData,
          });
          const data = (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            message?: string;
            url?: string;
          };
          if (!res.ok || !data.ok || !data.url) {
            setError(data.message ?? `「${file.name}」上传失败`);
            setBusy(false);
            return;
          }
          urls.push(data.url);
        }
      } else {
        urls = [link];
      }

      await onConfirm(urls);
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
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[560px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 outline-none"
      >
        <div className="sticky top-0 z-10 flex items-center justify-center border-b border-slate-100 bg-white px-6 py-4">
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

        <form onSubmit={apply} noValidate>
          <div className="px-6 py-5">
            <label htmlFor={urlInputId} className="text-sm font-medium text-slate-700">
              图片链接
            </label>
            <input
              id={urlInputId}
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError("");
                if (e.target.value.trim() && files.length > 0) {
                  setFiles([]);
                  if (fileRef.current) fileRef.current.value = "";
                }
              }}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-400/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            />

            <div className="mt-5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <p className="text-sm font-medium text-slate-700">或上传本地图片</p>
            </div>
            <label
              htmlFor={fileInputId}
              onDragOver={(e) => {
                e.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragLeave={(e) => {
                const nextTarget = e.relatedTarget;
                if (!(nextTarget instanceof Node) || !e.currentTarget.contains(nextTarget)) {
                  setDragging(false);
                }
              }}
              onDrop={handleDrop}
              className={`mt-2 flex min-h-[150px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-8 text-center transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/10 ${
                dragging
                  ? "border-brand-400 bg-brand-50/60"
                  : "border-slate-300 bg-slate-50/40 hover:border-slate-400 hover:bg-slate-50"
              } ${busy ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
            >
              <input
                id={fileInputId}
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple={kind === "screenshot"}
                onChange={handleFileInput}
                disabled={busy}
                className="sr-only"
              />
              <ImageIcon className="size-9 text-brand-500" strokeWidth={1.5} />
              <span className="text-sm font-medium text-slate-700">点击或拖动图片到此处上传</span>
            </label>

            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <Paperclip className="size-3.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                      {file.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatFileSize(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      disabled={busy}
                      aria-label={`移除 ${file.name}`}
                      className="grid size-6 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={busy || (files.length === 0 && !url.trim())}
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
