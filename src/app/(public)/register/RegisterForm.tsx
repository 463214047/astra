"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function RegisterForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0); // 倒计时秒数

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // 倒计时 effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // 密码一致性校验（内联）：两字段都非空时才比较，避免输入过程中频繁报红
  const passwordMismatch =
    password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword;

  // 副标题消息区域 — 四级优先级：loading > error > success > 默认引导
  const statusMessage = loadingMsg || error || successMsg;
  const isStatusError = !!error && !loadingMsg;
  const isStatusSuccess = !!successMsg && !error && !loadingMsg;
  const isStatusLoading = !!loadingMsg;

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 3000);
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
        body: JSON.stringify({ email, purpose: "register" }),
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

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setSuccessMsg(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("请填写邮箱地址");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("邮箱格式不正确");
      return;
    }
    if (!code) {
      setError("请填写邮箱验证码");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("验证码格式错误（应为 6 位数字）");
      return;
    }
    if (password && !confirmPassword) {
      setError("请再次输入密码");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoadingMsg("注册中…");
    setLoading(true);

    let redirecting = false;

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          confirmPassword,
          name: name.trim(),
          code,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        user?: { id: string; email: string; name: string | null };
        message?: string;
        error?: { message: string };
      };

      if (!res.ok || !data.ok) {
        setLoadingMsg(null);
        setError(data.error?.message ?? data.message ?? "注册失败，请稍后重试");
        return;
      }

      // 未设置密码：无法用 credentials 自动登录，引导用户使用 GitHub 登录
      if (!password) {
        redirecting = true;
        setLoadingMsg(null);
        setSuccessMsg("注册成功，请使用 GitHub 登录");
        setTimeout(() => router.push("/login"), 1200);
        return;
      }

      // 注册成功，自动登录（让 loadingMsg 一直显示到浏览器跳走）
      setError(null);
      setSuccessMsg(null);
      setLoadingMsg("注册成功，正在登录…");
      redirecting = true;

      try {
        // redirect=true — signIn 内部会 window.location.href = "/"
        // 浏览器会离开 Register 页，组件卸载，loadingMsg 自然消失
        await signIn("credentials", {
          email: normalizedEmail,
          password,
          redirect: true,
          callbackUrl: "/",
        });
      } catch {
        redirecting = false;
        setLoadingMsg(null);
        setError("自动登录失败，请手动登录");
        setTimeout(() => router.push("/login?registered=1"), 1500);
        return;
      }
    } catch (err) {
      console.error("[register] 注册异常:", err);
      setLoadingMsg(null);
      setError("网络异常，请稍后重试");
    } finally {
      // 成功跳转时保持 loading=true 直到整页离开
      if (!redirecting) setLoading(false);
    }
  }

  return (
    <Card className="relative z-10 w-full max-w-[420px] gap-0 overflow-hidden rounded-[28px] border border-slate-900/[0.08] bg-white/80 py-0 shadow-[0_24px_60px_rgba(15,23,42,0.08),0_2px_8px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl">
      <CardContent className="flex flex-col items-center px-8 pb-7 pt-10">
        {/* Logo — 与登录页完全一致 */}
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

        <h1 className="mb-2 text-[26px] font-bold tracking-[-0.03em] text-[#0b1220]">Astra PT</h1>

        {/* 副标题状态文案 — 与登录页完全一致 */}
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
            statusMessage || "创建你的账号"
          )}
        </p>

        {/* ====== 注册表单 ====== */}
        <form className="w-full space-y-3" onSubmit={handleRegister} noValidate>
          {/* 昵称（可选） */}
          <div className="space-y-1">
            <label htmlFor="register-name" className="sr-only">
              昵称
            </label>
            <input
              id="register-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="昵称"
              autoComplete="nickname"
              aria-invalid={!!error}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* 邮箱 */}
          <div className="space-y-1">
            <label htmlFor="register-email" className="sr-only">
              邮箱地址
            </label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="邮箱地址"
              autoComplete="email"
              required
              aria-invalid={!!error}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* 邮箱验证码 */}
          <div className="space-y-1">
            <label htmlFor="register-code" className="sr-only">
              邮箱验证码
            </label>
            <div className="flex gap-2">
              <input
                id="register-code"
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
                required
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

          {/* 密码 */}
          <div className="space-y-1">
            <label htmlFor="register-password" className="sr-only">
              密码
            </label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="密码"
              autoComplete="new-password"
              aria-invalid={!!error}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* 确认密码 */}
          <div className="space-y-1">
            <label htmlFor="register-confirm" className="sr-only">
              确认密码
            </label>
            <input
              id="register-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="确认密码"
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

          {/* 主操作按钮 — 与登录页完全一致 */}
          <Button
            type="submit"
            className="mt-2 h-[48px] w-full rounded-[14px] bg-brand-600 text-[15px] font-bold text-white shadow-lg shadow-brand-600/20 transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-600/30"
          >
            创建账号
          </Button>
        </form>

        {/* ====== 去登录 ====== */}
        <p className="mt-5 text-center text-xs text-slate-500">
          已有账号？{" "}
          <Link
            href="/login"
            className="font-semibold text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:rounded"
          >
            立即登录
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

/* ---------- 加载旋转图标 — requestAnimationFrame 驱动，不依赖 CSS keyframes ---------- */
function Spinner() {
  const [rot, setRot] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      // 1 秒一圈 = 360°/1000ms
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
