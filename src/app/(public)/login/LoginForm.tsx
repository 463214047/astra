"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AUTH_CODES, AUTH_ERROR_MESSAGES, NEXTAUTH_ERROR_FALLBACK } from "@/lib/auth-codes";

export default function LoginForm() {
  const router = useRouter();

  const [showTotp, setShowTotp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [remember, setRemember] = useState(true);

  const [credentialLoading, setCredentialLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const isAnyLoading = credentialLoading || githubLoading;

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);
  const totpInputRef = useRef<HTMLInputElement | null>(null);

  // 计算当前要显示的副标题状态文案
  // 优先级：loading > 错误 > 成功 > 默认引导文案
  const statusMessage = loadingMsg || error || successMsg;
  const isStatusLoading = !!loadingMsg;
  const isStatusError = !loadingMsg && !!error;
  const isStatusSuccess = !loadingMsg && !!successMsg && !error;

  useEffect(() => {
    if (showTotp) {
      setTimeout(() => totpInputRef.current?.focus(), 150);
    }
  }, [showTotp]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // NextAuth CredentialsSignin 通过 result.error + result.code 传递错误
  // 前端根据 AUTH_ERROR_MESSAGES 映射为中文消息；非 CredentialsSignin 错误用 NEXTAUTH_ERROR_FALLBACK 兜底

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoadingMsg("登录中…");
    setCredentialLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        remember: String(remember),
        redirect: false,
      });

      if (result?.error) {
        const code = result.code ?? "";

        // TOTP 二次验证：切换到 TOTP 输入步骤
        if (code === AUTH_CODES.TOTP_REQUIRED) {
          setShowTotp(true);
          setLoadingMsg(null);
          setCredentialLoading(false);
          setError(null);
          return;
        }

        // CredentialsSignin 错误：根据 code 映射中文
        // 其他 NextAuth 错误类型：用 fallback 兜底
        const msg =
          result.error === "CredentialsSignin"
            ? (AUTH_ERROR_MESSAGES[code] ?? AUTH_ERROR_MESSAGES[AUTH_CODES.INVALID_CREDENTIALS])
            : (NEXTAUTH_ERROR_FALLBACK[result.error] ?? "登录失败，请稍后重试");

        setError(msg);
        setLoadingMsg(null);
        setCredentialLoading(false);
        return;
      }

      // 登录成功 — 保持 loading=true 直到页面跳转
      setSuccessMsg("登录成功，正在跳转…");
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("[login] credentials 登录异常:", err);
      setError("网络异常，请稍后重试");
      setLoadingMsg(null);
      setCredentialLoading(false);
    }
  }

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoadingMsg("验证中…");
    setCredentialLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        totp,
        remember: String(remember),
        redirect: false,
      });

      if (result?.error) {
        const code = result.code ?? "";
        const msg =
          result.error === "CredentialsSignin"
            ? (AUTH_ERROR_MESSAGES[code] ?? "验证失败，请重新输入")
            : (NEXTAUTH_ERROR_FALLBACK[result.error] ?? "登录失败，请稍后重试");
        setError(msg);
        setLoadingMsg(null);
        setCredentialLoading(false);
        return;
      }

      // 验证成功 — 保持 loading=true 直到页面跳转
      setSuccessMsg("登录成功，正在跳转…");
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("[login] TOTP 验证异常:", err);
      setError("网络异常，请稍后重试");
      setLoadingMsg(null);
      setCredentialLoading(false);
    }
  }

  const handleTotpChange = (val: string) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 6);
    setTotp(cleaned);
    setError(null);
  };

  async function handleGithubLogin() {
    setError(null);
    setSuccessMsg(null);

    // ---- 预检：浏览器报告离线 ----
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError("网络已断开，请检查您的网络连接后重试");
      return;
    }

    setLoadingMsg("正在连接 GitHub…");
    setGithubLoading(true);

    try {
      // NextAuth v5: 对 OAuth provider 用 redirect:false 会拿到授权 URL 而不是直接跳
      // 这样 React 有机会先把 disabled 状态渲染出来
      const result = await signIn("github", { callbackUrl: "/", redirect: false });

      if (result?.error === "Configuration") {
        setGithubLoading(false);
        setLoadingMsg(null);
        setError("GitHub 登录未配置，请联系管理员");
        return;
      }

      const oauthUrl = result?.url;
      if (!oauthUrl) {
        setGithubLoading(false);
        setLoadingMsg(null);
        setError("GitHub 登录失败，请稍后重试");
        return;
      }

      // 给 React 足够时间把 disabled 按钮渲染出来再跳转
      // 200ms 足够下一帧 paint，用户也能清楚看到"正在连接 GitHub…"状态
      window.setTimeout(() => {
        window.location.href = oauthUrl;
      }, 200);
    } catch (err) {
      console.error("[login] GitHub 登录异常:", err);
      setGithubLoading(false);
      setLoadingMsg(null);
      setError("网络异常，请稍后重试");
    }
  }

  return (
    <Card className="relative z-10 w-full max-w-[420px] gap-0 overflow-hidden rounded-[28px] border border-slate-900/[0.08] bg-white/80 py-0 shadow-[0_24px_60px_rgba(37,99,235,0.10),0_2px_8px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl">
      <CardContent className="flex flex-col items-center px-8 pb-7 pt-10">
        {/* Logo */}
        <div className="mb-7 flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-[#2563eb] to-[#38bdf8] p-[3px] shadow-[0_12px_28px_rgba(37,99,235,0.28)]">
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

        <h1 className="mb-2 text-[26px] font-bold tracking-[-0.03em] text-[#0b1220]">
          Astra PT
        </h1>

        {/* ✅ 修复：补全了缺失的文案内容和闭合标签 */}
        <p
          className={`mb-8 min-h-[20px] text-sm transition-colors duration-300 ${
            isStatusLoading
              ? "font-medium text-[#2563eb]"
              : isStatusError
                ? "font-medium text-red-500"
                : isStatusSuccess
                  ? "font-medium text-green-600"
                  : "text-slate-500"
          }`}
          role={isStatusError ? "alert" : "status"}
          aria-live="polite"
        >
          {statusMessage ? (
            isStatusLoading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner />
                {statusMessage}
              </span>
            ) : (
              statusMessage
            )
          ) : showTotp ? (
            "完成最后一步验证"
          ) : (
            "欢迎回来"
          )}
        </p>

        {/* ====== 统一表单 ====== */}
        <form
          className="w-full space-y-3"
          onSubmit={showTotp ? handleTotpSubmit : handleCredentialsSubmit}
          noValidate
        >
          {/* 邮箱 & 密码区域 */}
          <div
            className={`grid transition-all duration-300 ease-out ${
              showTotp
                ? "grid-rows-[0fr] opacity-0 pointer-events-none"
                : "grid-rows-[1fr] opacity-100"
            }`}
          >
            <div className="overflow-hidden space-y-3">
              {/* 邮箱 */}
              <div className="space-y-1">
                <label htmlFor="login-email" className="sr-only">
                  邮箱地址
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="邮箱地址"
                  autoComplete="email"
                  autoFocus={!showTotp}
                  aria-invalid={!!error && !showTotp}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                />
              </div>

              {/* 密码 */}
              <div className="space-y-1">
                <label htmlFor="login-password" className="sr-only">
                  密码
                </label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="密码"
                  autoComplete="current-password"
                  aria-invalid={!!error && !showTotp}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                />
              </div>

              {/* 记住我 + 忘记密码 */}
              <div className="flex items-center justify-between text-xs">
                <label className="flex cursor-pointer select-none items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="size-3.5 cursor-pointer rounded border-slate-300 accent-[#2563eb]"
                  />
                  记住我
                </label>
                <a
                  href="/forgot-password"
                  className="font-medium text-[#2563eb] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/40 focus-visible:rounded"
                >
                  忘记密码？
                </a>
              </div>
            </div>
          </div>

          {/* ====== TOTP 输入框 ====== */}
          <div
            className={`grid transition-all duration-300 ease-out ${
              showTotp
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <div className="space-y-3">
                {/* TOTP 标题 */}
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <div className="grid size-7 place-items-center rounded-full bg-[#2563eb]/10">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="size-4 text-[#2563eb]"
                      aria-hidden="true"
                    >
                      <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </div>
                  二次验证
                </div>

                {/* TOTP 输入框 */}
                <div className="space-y-1">
                  <label htmlFor="totp-input" className="sr-only">
                    6位验证码
                  </label>
                  <input
                    ref={totpInputRef}
                    id="totp-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={totp}
                    onChange={(e) => handleTotpChange(e.target.value)}
                    tabIndex={showTotp ? 0 : -1}
                    aria-invalid={!!error && showTotp}
                    className="h-14 w-full rounded-xl border border-slate-200 bg-white text-center text-2xl font-bold tracking-[0.5em] text-slate-900 outline-none transition placeholder:tracking-normal placeholder:text-slate-300 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                  />
                </div>

                {/* 返回按钮 */}
                <button
                  type="button"
                  onClick={() => {
                    setShowTotp(false);
                    setTotp("");
                    setError(null);
                  }}
                  className="text-xs text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/40 focus-visible:rounded"
                >
                  ← 修改账号密码
                </button>
              </div>
            </div>
          </div>

          {/* 主操作按钮 */}
          <Button
            type="submit"
            disabled={isAnyLoading || (showTotp && totp.length !== 6)}
            className="disabled-primary h-[48px] w-full rounded-[14px] bg-[#0b1220] text-[15px] font-bold text-white shadow-[0_12px_26px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:bg-[#111827] hover:shadow-[0_18px_36px_rgba(37,99,235,0.28)] disabled:translate-y-0"
          >
            {credentialLoading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner />
                {showTotp ? "验证中…" : "登录中…"}
              </span>
            ) : (
              showTotp ? "验证并登录" : "登录"
            )}
          </Button>
        </form>

        {/* ====== 分隔线 + GitHub ====== */}
        {!showTotp && (
          <>
            <div className="my-5 flex w-full items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">或使用以下方式</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGithubLogin}
              disabled={isAnyLoading}
              className="disabled-outline h-[48px] w-full rounded-[14px] text-[15px] font-semibold shadow-sm transition disabled:translate-y-0 hover:-translate-y-0.5 hover:shadow-md border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2.5">
                {githubLoading ? (
                  <>
                    <Spinner />
                    连接中…
                  </>
                ) : (
                  <>
                    <GitHubIcon className="size-5" />
                    使用 GitHub 登录
                  </>
                )}
              </span>
            </Button>

            {/* ====== 去注册 ====== */}
            <p className="mt-5 text-center text-xs text-slate-500">
              还没有账号？{" "}
              <Link
                href="/register"
                className="font-semibold text-[#2563eb] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/40 focus-visible:rounded"
              >
                立即注册
              </Link>
            </p>
          </>
        )}
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
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity={0.75} />
    </svg>
  );
}

/* ---------- GitHub 图标 ---------- */
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2.18c-3.2.7-3.88-1.36-3.88-1.36-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.75.4-1.27.73-1.56-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.27 1.19-3.07-.12-.29-.52-1.45.11-3.02 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.57.23 2.73.11 3.02.74.8 1.19 1.82 1.19 3.07 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.04.77 2.1v3.11c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}