"use client";

import { useCallback, useEffect, useState } from "react";

type StatusResp = {
  has_password: boolean;
};

export default function AccountPage() {
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [mounted, setMounted] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 设置密码表单
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  const isOAuthOnly = !!(status && !status.has_password);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/oauth/status");
      const data = await res.json();
      if (res.ok && data.ok) setStatus({ has_password: data.has_password });
    } catch {
      // 忽略
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchStatus();
  }, [fetchStatus]);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdError(null);
    if (!newPwd.trim()) {
      setPwdError("请输入密码");
      return;
    }
    if (!confirmPwd.trim()) {
      setPwdError("请再次输入密码");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError("两次输入的密码不一致");
      return;
    }
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
      setNewPwd("");
      setConfirmPwd("");
      await fetchStatus();
    } catch {
      setPwdError("网络错误");
      setPwdLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      {mounted && !status && <div className="text-xs text-slate-400">加载中…</div>}

      {mounted && !!status && isOAuthOnly && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 [[data-background=tohru]_&]:bg-transparent">
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
                onChange={(e) => {
                  setNewPwd(e.target.value);
                  setPwdError(null);
                }}
                placeholder="任意长度，支持任意字符"
                disabled={pwdLoading}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">确认密码</label>
              <input
                type="password"
                value={confirmPwd}
                onChange={(e) => {
                  setConfirmPwd(e.target.value);
                  setPwdError(null);
                }}
                placeholder="再次输入新密码"
                disabled={pwdLoading}
                className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 disabled:opacity-60 ${
                  confirmPwd && newPwd !== confirmPwd
                    ? "border-red-400 focus:border-red-400 focus:ring-red-200"
                    : "border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
                }`}
              />
              {confirmPwd && newPwd !== confirmPwd && (
                <p className="mt-1 text-xs font-medium text-red-600" role="alert">
                  两次输入的密码不一致
                </p>
              )}
            </div>

            {pwdError && (
              <p className="text-xs font-medium text-red-600" role="alert">
                {pwdError}
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-slate-400">设置前你只能通过 GitHub 登录</p>
              <button
                type="submit"
                disabled={!newPwd || !confirmPwd || newPwd !== confirmPwd || pwdLoading}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                {pwdLoading ? "设置中…" : "设置密码"}
              </button>
            </div>
          </form>
        </section>
      )}

      {msg && (
        <div
          className={`mt-6 rounded-lg border px-3 py-2 text-xs font-medium ${
            msg.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
