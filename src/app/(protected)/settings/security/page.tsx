"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import QRCode from "qrcode";

type StatusResp = { ok: true; enabled: boolean; hasPassword: boolean };
type SetupResp = { ok: true; authUrl: string };

export default function SecurityPage() {
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- 启用流程状态 ----
  const [step, setStep] = useState<"idle" | "setup" | "verify" | "done">("idle");
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // ---- Disable 流程 ----
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePwd, setDisablePwd] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);

  // ---- 重设密码 ----
  const [pwdOpen, setPwdOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  // ---- 表单 ----
  const [setupPwd, setSetupPwd] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"info" | "success" | "error">("info");

  /* ==================== 获取状态 ==================== */
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/2fa/status");
      const data = await res.json();
      if (res.ok && data.ok) setStatus(data);
      else setError(data.message ?? "获取状态失败");
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // 从设置页“重设密码”跳转过来时，自动展开密码表单
  useEffect(() => {
    if (window.location.hash !== "#password") return;
    const frame = requestAnimationFrame(() => setPwdOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  /* ==================== 启动 Setup ==================== */
  async function startSetup(e: React.FormEvent) {
    e.preventDefault();
    setSetupLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/2fa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: setupPwd }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message ?? "设置失败");
        return;
      }
      const s = data as SetupResp;
      setAuthUrl(s.authUrl);
      // 异步生成 QR
      const qr = await QRCode.toDataURL(s.authUrl, { width: 220, margin: 1 });
      setQrDataUrl(qr);
      setStep("setup");
    } catch (err) {
      setError("网络错误：" + (err as Error).message);
    } finally {
      setSetupLoading(false);
    }
  }

  /* ==================== 验证并启用 ==================== */
  async function confirmVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/2fa/verify", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message ?? "验证失败");
        return;
      }
      setStep("done");
      setMsg("✓ 2FA 已启用。");
      setMsgType("success");
      await fetchStatus();
    } catch (err) {
      setError("网络错误：" + (err as Error).message);
    }
  }

  /* ==================== 禁用 2FA ==================== */
  async function doDisable(e: React.FormEvent) {
    e.preventDefault();
    setDisableLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/2fa/disable", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePwd, code: disableCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message ?? "禁用失败");
        return;
      }
      setDisableOpen(false);
      setDisablePwd("");
      setDisableCode("");
      setStep("idle");
      setAuthUrl(null);
      setQrDataUrl(null);
      await fetchStatus();
      setMsg("✓ 2FA 已禁用");
      setMsgType("success");
    } catch (err) {
      setError("网络错误：" + (err as Error).message);
    } finally {
      setDisableLoading(false);
    }
  }

  /* ==================== 重设密码 ==================== */
  function openPwdForm() {
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
    setPwdError(null);
    setMsg(null);
    setPwdOpen(true);
  }

  function closePwdForm() {
    if (pwdLoading) return;
    setPwdOpen(false);
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
    setPwdError(null);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdError(null);
    setMsg(null);

    if (!currentPwd) {
      setPwdError("请输入当前密码");
      return;
    }
    if (newPwd.length < 6) {
      setPwdError("新密码至少 6 位");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError("两次输入的新密码不一致");
      return;
    }

    setPwdLoading(true);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPwd,
          new_password: newPwd,
          confirm_password: confirmPwd,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setPwdError(data.message ?? "重设失败");
        return;
      }

      setPwdOpen(false);
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setMsg("✓ 密码已重设");
      setMsgType("success");
    } catch {
      setPwdError("网络错误，请稍后重试");
    } finally {
      setPwdLoading(false);
    }
  }

  /* ==================== 渲染 ==================== */
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">安全设置</h1>
      <p className="mb-6 text-sm text-slate-500">保护你的账号安全，建议启用两步验证。</p>

      {/* 提示消息 */}
      {msg && (
        <div
          className={`mb-4 rounded-lg border px-4 py-2.5 text-sm font-medium ${
            msgType === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : msgType === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-brand-200 bg-brand-50 text-brand-700"
          }`}
        >
          {msg}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* 登录密码卡片 */}
      <section
        id="password"
        className="mb-6 scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <KeyRound className="size-5 text-brand-700" aria-hidden="true" />
              登录密码
            </h2>
            <p className="mt-1 text-sm text-slate-500">定期更换密码可以降低账号被盗风险。</p>
          </div>
          {status?.hasPassword && !pwdOpen && (
            <button
              type="button"
              onClick={openPwdForm}
              className="shrink-0 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
            >
              重设密码
            </button>
          )}
        </div>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> 加载中…
          </div>
        ) : !status ? (
          <p className="mt-4 text-sm text-slate-500">无法获取密码状态，请刷新页面重试。</p>
        ) : status.hasPassword ? (
          pwdOpen ? (
            <form onSubmit={changePassword} noValidate className="mt-5 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">当前密码</label>
                <input
                  type="password"
                  value={currentPwd}
                  onChange={(e) => {
                    setCurrentPwd(e.target.value);
                    setPwdError(null);
                  }}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  placeholder="输入当前密码"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">新密码</label>
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => {
                    setNewPwd(e.target.value);
                    setPwdError(null);
                  }}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  placeholder="至少 6 位"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">确认新密码</label>
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => {
                    setConfirmPwd(e.target.value);
                    setPwdError(null);
                  }}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  placeholder="再次输入新密码"
                />
              </div>

              {confirmPwd && newPwd !== confirmPwd && (
                <p className="text-xs font-medium text-red-600">两次输入的新密码不一致</p>
              )}
              {pwdError && (
                <p
                  aria-live="polite"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                >
                  {pwdError}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <a
                  href="/forgot-password"
                  className="text-xs text-slate-500 transition hover:text-brand-700 hover:underline"
                >
                  忘记当前密码？通过邮箱重置
                </a>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closePwdForm}
                    disabled={pwdLoading}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={
                      pwdLoading || !currentPwd || newPwd.length < 6 || newPwd !== confirmPwd
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
                  >
                    {pwdLoading && <Spinner />}
                    {pwdLoading ? "重设中…" : "确认重设"}
                  </button>
                </div>
              </div>
            </form>
          ) : null
        ) : (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
            <p className="text-sm font-medium text-amber-900">当前账号未设置登录密码</p>
            <p className="mt-1 text-xs text-amber-800">
              你目前通过 GitHub 登录。设置密码后即可使用邮箱 + 密码登录。
            </p>
            <a
              href="/settings/account"
              className="mt-3 inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700"
            >
              前往账号设置 →
            </a>
          </div>
        )}
      </section>

      {/* 2FA 卡片 */}
      <section
        id="two-factor"
        className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <ShieldIcon /> 两步验证（2FA / TOTP）
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              登录时需输入认证器生成的 6 位码，即使密码泄露也无法登录。
            </p>
          </div>
          {status?.enabled && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              已启用
            </span>
          )}
          {!status?.enabled && !loading && (
            <span className="shrink-0 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              未启用
            </span>
          )}
        </div>

        <hr className="my-5 border-slate-100" />

        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> 加载中…
          </div>
        )}

        {/* ===== 状态：已启用 ===== */}
        {status?.enabled && step === "idle" && (
          <div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
              <p className="text-sm text-emerald-900">✓ 两步验证已启用。</p>
            </div>

            <button
              type="button"
              onClick={() => setDisableOpen(true)}
              className="mt-4 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              禁用两步验证
            </button>
          </div>
        )}

        {/* ===== 状态：未启用 → OAuth-only 账号引导设置密码 ===== */}
        {!status?.enabled && !loading && step === "idle" && !status?.hasPassword && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
            <p className="text-sm font-medium text-amber-900">请先设置登录密码</p>
            <p className="mt-1 text-xs text-amber-800">
              启用两步验证需要先通过密码确认你的身份。前往账号设置中为当前 GitHub 登录设置密码。
            </p>
            <a
              href="/settings/account"
              className="mt-3 inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700"
            >
              前往账号设置 →
            </a>
          </div>
        )}

        {/* ===== 状态：未启用 → 启动 ===== */}
        {!status?.enabled && !loading && step === "idle" && status?.hasPassword && (
          <form onSubmit={startSetup} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">当前密码</label>
              <input
                type="password"
                value={setupPwd}
                onChange={(e) => setSetupPwd(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                placeholder="输入密码以确认身份"
                required
              />
            </div>
            <button
              type="submit"
              disabled={setupLoading || !setupPwd}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {setupLoading && <Spinner />}
              {setupLoading ? "生成中…" : "开始设置两步验证"}
            </button>
          </form>
        )}

        {/* ===== 步骤 1：展示 QR ===== */}
        {step === "setup" && authUrl && (
          <div className="space-y-5">
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-900">第 1 步：扫描二维码</h3>
              <p className="mb-3 text-xs text-slate-500">
                使用 Google Authenticator、1Password、Authy 或类似 App 扫描下方二维码。
              </p>
              <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="TOTP 二维码"
                    width={220}
                    height={220}
                    className="rounded-md bg-white p-1"
                  />
                ) : (
                  <div className="grid size-[220px] place-items-center text-sm text-slate-400">
                    <Spinner /> 生成中…
                  </div>
                )}
                <p
                  className="w-full truncate text-center font-mono text-xs text-slate-500"
                  title={authUrl}
                >
                  {authUrl}
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-900">第 2 步：输入验证码启用</h3>
              <form onSubmit={confirmVerify} className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}

                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-center font-mono text-base tracking-[0.5em] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  autoComplete="one-time-code"
                  required
                />
                <button
                  type="submit"
                  disabled={verifyCode.length !== 6}
                  className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
                >
                  启用
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ===== 步骤完成 ===== */}
        {step === "done" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-5 text-center">
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-emerald-100">
              <svg
                viewBox="0 0 24 24"
                className="size-7 text-emerald-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="font-semibold text-emerald-900">两步验证已启用</p>
            <p className="mt-1 text-xs text-emerald-700">
              下次登录时，密码验证通过后将要求输入认证器生成的 6 位码。
            </p>
          </div>
        )}
      </section>

      {/* ===== Disable 弹窗 ===== */}
      {disableOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={() => !disableLoading && setDisableOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-900">禁用两步验证</h3>
            <p className="mt-1 text-sm text-slate-500">
              禁用后登录只需密码，账号安全性将降低。请再次确认你的密码和当前验证码。
            </p>
            <form onSubmit={doDisable} className="mt-5 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">当前密码</label>
                <input
                  type="password"
                  value={disablePwd}
                  onChange={(e) => setDisablePwd(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  当前 6 位验证码
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-center font-mono tracking-[0.5em] outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => !disableLoading && setDisableOpen(false)}
                  disabled={disableLoading}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={disableLoading || disableCode.length !== 6}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  {disableLoading && <Spinner />}
                  确认禁用
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== Shield Icon ==================== */
function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 text-brand-700"
      aria-hidden="true"
    >
      <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/* ==================== 轻量 Spinner ==================== */
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
