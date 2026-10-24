"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

type OAuthAccount = {
  provider: string;
  provider_name: string | null;
  provider_avatar: string | null;
  created_at: string;
};

type StatusResp = {
  accounts: OAuthAccount[];
  has_password: boolean;
};

const PROVIDER_META: Record<
  string,
  { label: string; color: string; icon: React.ReactNode; hover: string }
> = {
  github: {
    label: "GitHub",
    color: "bg-slate-900 text-white",
    hover: "hover:bg-slate-800",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-5">
        <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.57.1.78-.25.78-.55v-2c-3.2.7-3.88-1.36-3.88-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.21-1.5 3.18-1.18 3.18-1.18.62 1.59.23 2.77.11 3.06.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.25 5.69.41.35.77 1.04.77 2.1v3.12c0 .3.21.66.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
      </svg>
    ),
  },
};

export default function AccountPage() {
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [mounted, setMounted] = useState(false);
  const [msg, setMsg] = useState<{ type: "info" | "error" | "success"; text: string } | null>(null);

  // 设置密码表单
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  const isOAuthOnly = !!(status && !status.has_password);
  const isBound = !!status?.accounts?.some((a) => a.provider === "github");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/oauth/status");
      const data = await res.json();
      if (res.ok && data.ok) setStatus({ accounts: data.accounts, has_password: data.has_password });
    } catch {
      // 忽略
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchStatus();
  }, [fetchStatus]);

  async function handleBind() {
    setMsg(null);
    await signIn("github", { callbackUrl: "/settings/account" });
  }

  async function handleUnbind() {
    setMsg(null);
    try {
      const res = await fetch("/api/oauth/unbind?provider=github", { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setMsg({ type: "success", text: "GitHub 已解绑" });
        await fetchStatus();
      } else {
        setMsg({ type: "error", text: data.message ?? "解绑失败" });
      }
    } catch {
      setMsg({ type: "error", text: "网络错误" });
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdError(null);
    if (!newPwd.trim()) { setPwdError("请输入密码"); return; }
    if (!confirmPwd.trim()) { setPwdError("请再次输入密码"); return; }
    if (newPwd !== confirmPwd) { setPwdError("两次输入的密码不一致"); return; }
    setPwdLoading(true);
    try {
      const res = await fetch("/api/account/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: newPwd, confirm_password: confirmPwd }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPwdError(data.message ?? "设置失败");
        setPwdLoading(false);
        return;
      }
      setMsg({ type: "success", text: "密码设置成功！现在你可以用邮箱+密码登录了" });
      setNewPwd(""); setConfirmPwd("");
      await fetchStatus();
    } catch {
      setPwdError("网络错误");
      setPwdLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/profile" className="hover:text-slate-700">个人主页</Link>
        <span>/</span>
        <Link href="/settings" className="hover:text-slate-700">设置</Link>
        <span>/</span>
        <span className="text-slate-700">账号与绑定</span>
      </div>

      {mounted && !status && (
        <div className="text-xs text-slate-400">加载中…</div>
      )}

      {mounted && !!status && isOAuthOnly && isBound && (
        <>
          {/* OAuth-only 账号 — 显示 GitHub 信息 + 设置密码 */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">登录方式</h2>
            <p className="mt-1 text-xs text-slate-500">当前通过 GitHub 登录</p>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${PROVIDER_META.github.color}`}>
                  {PROVIDER_META.github.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">GitHub</p>
                  <p className="mt-0.5 text-xs text-slate-500 truncate">
                    已绑定 · {status?.accounts.find((a) => a.provider === "github")?.provider_name ?? "Unknown"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleUnbind}
                  title="解绑后你将无法登录（没有密码）"
                  disabled={status!.accounts.length <= 1 && !status!.has_password}
                  className="ml-auto shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-white hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  解绑
                </button>
              </div>
            </div>
          </section>

          {/* 设置密码模块 */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">设置登录密码</h2>
            <p className="mt-1 text-xs text-slate-500">
              设置密码后，你可以用邮箱 + 密码的方式登录，不必每次依赖 GitHub。
            </p>

            <form onSubmit={handleSetPassword} className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">新密码</label>
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => { setNewPwd(e.target.value); setPwdError(null); }}
                  placeholder="任意长度，支持任意字符"
                  disabled={pwdLoading}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">确认密码</label>
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => { setConfirmPwd(e.target.value); setPwdError(null); }}
                  placeholder="再次输入新密码"
                  disabled={pwdLoading}
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 disabled:opacity-60 ${
                    confirmPwd && newPwd !== confirmPwd
                      ? "border-red-400 focus:border-red-400 focus:ring-red-200"
                      : "border-slate-200 focus:border-[#2563eb] focus:ring-[#2563eb]/20"
                  }`}
                />
                {confirmPwd && newPwd !== confirmPwd && (
                  <p className="mt-1 text-xs font-medium text-red-600" role="alert">两次输入的密码不一致</p>
                )}
              </div>

              {pwdError && (
                <p className="text-xs font-medium text-red-600" role="alert">{pwdError}</p>
              )}

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-slate-400">设置前你只能通过 GitHub 登录</p>
                <button
                  type="submit"
                  disabled={!newPwd || !confirmPwd || newPwd !== confirmPwd || pwdLoading}
                  className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  {pwdLoading ? "设置中…" : "设置密码"}
                </button>
              </div>
            </form>
          </section>
        </>
      )}

      {/* Credentials 账号 — 原有的绑定/解绑 */}
      {mounted && !!status && !isOAuthOnly && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">绑定第三方登录</h2>
          <p className="mt-1 text-xs text-slate-500">绑定后，你可以用 GitHub 快捷登录</p>

          <ul className="mt-4 space-y-3">
            <li
              className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition ${
                isBound
                  ? "border-slate-200 bg-slate-50/50"
                  : "border-dashed border-slate-200 bg-slate-50/30"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${PROVIDER_META.github.color}`}>
                  {PROVIDER_META.github.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">GitHub</p>
                  {isBound && (
                    <p className="mt-0.5 text-xs text-slate-500 truncate">
                      已绑定 · {status?.accounts.find((a) => a.provider === "github")?.provider_name ?? "Unknown"}
                    </p>
                  )}
                  {!isBound && <p className="mt-0.5 text-xs text-slate-400">未绑定</p>}
                </div>
              </div>

              {isBound ? (
                <button
                  type="button"
                  onClick={handleUnbind}
                  disabled={status!.accounts.length <= 1 && !status!.has_password}
                  className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-white hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  解绑
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleBind}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 ${PROVIDER_META.github.color} ${PROVIDER_META.github.hover}`}
                >
                  绑定
                </button>
              )}
            </li>
          </ul>
        </section>
      )}

      {msg && (
        <div
          className={`mt-6 rounded-lg border px-3 py-2 text-xs font-medium ${
            msg.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : msg.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-blue-200 bg-blue-50 text-blue-700"
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
