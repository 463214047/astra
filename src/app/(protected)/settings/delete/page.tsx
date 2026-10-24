"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

export default function DeletePage() {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [delLoading, setDelLoading] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  async function handleDelete() {
    setDelError(null);
    setDelLoading(true);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: pwd }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setDelError(data.message ?? "注销失败");
        setDelLoading(false);
        return;
      }
      await signOut({ redirect: false });
      router.push("/login");
      router.refresh();
    } catch (e) {
      setDelError("网络错误：" + (e as Error).message);
      setDelLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/profile" className="hover:text-slate-700">个人主页</Link>
        <span>/</span>
        <Link href="/settings" className="hover:text-slate-700">设置</Link>
        <span>/</span>
        <span className="text-slate-700">注销账号</span>
      </div>

      <section className="rounded-2xl border border-red-200 bg-red-50/40 p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-red-100">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-6 text-red-600">
              <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-red-900">注销账号</h2>
            <p className="mt-1 text-sm text-red-700 leading-relaxed">
              此操作<strong>不可逆</strong>。注销后你的所有数据将被永久删除，且无法恢复。
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-red-200 pt-5">
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-95"
          >
            注销我的账号
          </button>
        </div>
      </section>

      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={() => !delLoading && setDeleteOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-slate-900">确认注销账号</h3>
            <p className="mt-1.5 text-xs text-slate-500">
              请输入当前密码以确认注销。注销后将自动登出并跳转到登录页。
            </p>

            <input
              type="password"
              value={pwd}
              onChange={(e) => { setPwd(e.target.value); setDelError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && pwd.trim() && !delLoading) handleDelete(); }}
              placeholder="当前密码"
              autoFocus
              disabled={delLoading}
              className={`mt-4 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 disabled:opacity-60 ${
                delError
                  ? "border-red-400 focus:border-red-400 focus:ring-red-200"
                  : "border-slate-200 focus:border-red-400 focus:ring-red-200"
              }`}
            />
            {delError && (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">{delError}</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !delLoading && setDeleteOpen(false)}
                disabled={delLoading}
                className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!pwd.trim() || delLoading}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {delLoading ? "注销中…" : "确认注销"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
