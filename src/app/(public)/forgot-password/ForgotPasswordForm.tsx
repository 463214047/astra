"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ForgotPasswordForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [sendingCode, setSendingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordMismatch =
    password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit =
    !passwordMismatch && password.length >= 6 && confirmPassword.length > 0 && code.length === 6;

  const statusMessage = loadingMsg || error || successMsg;
  const isStatusError = !!error && !loadingMsg;
  const isStatusSuccess = !!successMsg && !error && !loadingMsg;
  const isStatusLoading = !!loadingMsg;

  // 倒计时
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  async function handleSendCode() {
    if (!emailValid || cooldown > 0 || sendingCode) return;
    setError(null);
    setSuccessMsg(null);
    setSendingCode(true);

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "reset_password" }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };

      if (!res.ok || !data.ok) {
        setError(data.message ?? "发送失败，请稍后重试");
        return;
      }

      setSuccessMsg("验证码已发送，请查收邮件");
      setCooldown(60);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSendingCode(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoadingMsg("正在重置…");
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password, confirmPassword }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: { message: string };
      };

      if (!res.ok || !data.ok) {
        setLoadingMsg(null);
        setError(data.error?.message ?? data.message ?? "重置失败，请稍后重试");
        return;
      }

      // 重置成功 — 跳登录页 + 提示
      setError(null);
      setSuccessMsg(null);
      setLoadingMsg("重置成功，即将跳转…");
      setTimeout(() => router.push("/login?reset=1"), 1200);
    } catch (err) {
      console.error("[reset-password] 异常:", err);
      setLoadingMsg(null);
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="relative z-10 w-full max-w-[420px] gap-0 overflow-hidden rounded-[28px] border border-slate-900/[0.08] bg-white/80 py-0 shadow-[0_24px_60px_rgba(15,23,42,0.08),0_2px_8px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl">
      <CardContent className="flex flex-col items-center px-8 pb-7 pt-10">
        {/* Logo */}
        <div className="mb-7 flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-400 p-[3px] shadow-lg shadow-brand-600/25">
          <Image
            src="/icon.png"
            alt="Astra PT Logo"
            width={96}
            height={96}
            priority
            unoptimized
            className="h-full w-full rounded-full border-[3px] border-white object-cover"
          />
        </div>

        <h1 className="mb-2 text-[26px] font-bold tracking-[-0.03em] text-[#0b1220]">重置密码</h1>

        {/* 副标题状态文案 */}
        <p
          className={`mb-8 min-h-[20px] text-sm transition-colors duration-300 ${
            isStatusLoading
              ? "font-medium text-brand-700"
              : isStatusError
                ? "font-medium text-red-500"
                : isStatusSuccess
                  ? "font-medium text-green-600"
                  : "text-slate-500"
          }`}
          role={isStatusError ? "alert" : isStatusLoading || isStatusSuccess ? "status" : undefined}
          aria-live="polite"
        >
          {isStatusLoading ? (
            <span className="inline-flex items-center gap-1.5">
              <Spinner />
              {statusMessage}
            </span>
          ) : (
            statusMessage || "输入邮箱找回你的密码"
          )}
        </p>

        {/* ====== 表单 ====== */}
        <form className="w-full space-y-3" onSubmit={handleSubmit} noValidate>
          {/* 邮箱 */}
          <div className="space-y-1">
            <label htmlFor="fp-email" className="sr-only">
              邮箱地址
            </label>
            <input
              id="fp-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="邮箱地址"
              autoComplete="email"
              aria-invalid={!!error}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* 邮箱验证码 */}
          <div className="space-y-1">
            <label htmlFor="fp-code" className="sr-only">
              邮箱验证码
            </label>
            <div className="flex gap-2">
              <input
                id="fp-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setCode(v);
                  if (error) setError(null);
                }}
                placeholder="6 位验证码"
                autoComplete="one-time-code"
                aria-invalid={!!error}
                className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm tracking-[0.3em] text-slate-900 outline-none transition placeholder:tracking-normal placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={!emailValid || cooldown > 0 || sendingCode}
                className="h-11 shrink-0 rounded-xl border border-brand-600/30 bg-brand-600/5 px-4 text-sm font-semibold text-brand-700 transition hover:bg-brand-600/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
              >
                {sendingCode ? "发送中…" : cooldown > 0 ? `${cooldown}s 后重发` : "获取验证码"}
              </button>
            </div>
          </div>

          {/* 新密码 */}
          <div className="space-y-1">
            <label htmlFor="fp-password" className="sr-only">
              新密码
            </label>
            <input
              id="fp-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="新密码（至少 6 位）"
              autoComplete="new-password"
              aria-invalid={!!error}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* 确认密码 */}
          <div className="space-y-1">
            <label htmlFor="fp-confirm" className="sr-only">
              确认新密码
            </label>
            <input
              id="fp-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="再次输入新密码"
              autoComplete="new-password"
              aria-invalid={passwordMismatch}
              className={`h-11 w-full rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 ${
                passwordMismatch
                  ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                  : "border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
              }`}
            />
            {passwordMismatch && (
              <p className="pl-1 text-xs text-red-500" role="alert">
                两次输入的密码不一致
              </p>
            )}
          </div>

          {/* 主按钮 */}
          <Button
            type="submit"
            disabled={submitting || !canSubmit}
            className="mt-2 h-[48px] w-full rounded-[14px] bg-brand-600 text-[15px] font-bold text-white shadow-lg shadow-brand-600/20 transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-600/30 disabled:translate-y-0 disabled:opacity-60"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Spinner />
                重置中…
              </span>
            ) : (
              "重置密码"
            )}
          </Button>
        </form>

        {/* ====== 回登录 ====== */}
        <p className="mt-5 text-center text-xs text-slate-500">
          想起来了？{" "}
          <Link
            href="/login"
            className="font-semibold text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:rounded"
          >
            返回登录
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function Spinner() {
  const [rot, setRot] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setRot((r) => (r + dt * 0.36) % 360);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="size-4"
      style={{ transform: `rotate(${rot}deg)` }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity={0.25} />
      <path
        d="M4 12a8 8 0 018-8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity={0.75}
      />
    </svg>
  );
}
