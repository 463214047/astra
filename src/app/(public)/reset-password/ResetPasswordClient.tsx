"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ResetPasswordClient({ email }: { email: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const verifiedEmail = email?.trim() || null;
  const disabled = busy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!verifiedEmail) return;
    setError(null);

    if (!password.trim() || !confirmPassword.trim()) {
      setError("请填写新密码");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/account/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? "重置失败，请稍后重试");
        return;
      }
      // 密码已保存，直接进入站点（提交即登录）
      router.replace("/");
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="relative z-10 w-full max-w-[420px] gap-0 overflow-hidden rounded-[28px] border border-slate-900/[0.08] bg-white/80 py-0 shadow-[0_24px_60px_rgba(15,23,42,0.08),0_2px_8px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl">
      <CardContent className="flex flex-col items-center px-8 pb-8 pt-9">
        <h1 className="mb-1 text-[24px] font-bold tracking-[-0.03em] text-[#0b1220]">重置密码</h1>

        <p
          className={`mb-6 min-h-[20px] text-center text-sm ${
            error ? "font-medium text-red-500" : "text-slate-500"
          }`}
          role={error ? "alert" : "status"}
          aria-live="polite"
        >
          {error ?? (verifiedEmail ? "" : "请先通过 GitHub 验证身份")}
        </p>

        {verifiedEmail ? (
          <form className="w-full space-y-3" onSubmit={handleSubmit} noValidate>
            <div className="rounded-xl border border-brand-200 bg-brand-50/70 px-4 py-3 text-sm text-brand-800">
              已验证邮箱：<span className="font-semibold">{verifiedEmail}</span>
            </div>

            <div className="space-y-1">
              <label htmlFor="new-password" className="sr-only">
                新密码
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="新密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={disabled}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-4 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden"
                />
                <EyeButton
                  visible={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                  label={showPassword ? "隐藏密码" : "显示密码"}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="confirm-password" className="sr-only">
                确认新密码
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="确认新密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={disabled}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-4 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden"
                />
                <EyeButton
                  visible={showConfirm}
                  onToggle={() => setShowConfirm((v) => !v)}
                  label={showConfirm ? "隐藏密码" : "显示密码"}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={disabled}
              className="disabled-primary h-[48px] w-full rounded-[14px] bg-brand-600 text-[15px] font-bold text-white shadow-lg shadow-brand-600/20 transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-600/30 disabled:translate-y-0"
            >
              {busy ? "登录中…" : "登录"}
            </Button>
          </form>
        ) : (
          <Link
            href="/login"
            className="flex h-[48px] w-full items-center justify-center rounded-[14px] bg-brand-600 text-[15px] font-bold text-white shadow-lg shadow-brand-600/20 transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-600/30"
          >
            返回登录页验证身份
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function EyeButton({
  visible,
  onToggle,
  label,
}: {
  visible: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
        <path
          d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.6" />
        {visible && (
          <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
