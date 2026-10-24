"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserName } from "@/components/rainbow-name";

type ProfileData = {
  nickname: string;
  avatar_url: string;
  rainbow_enabled: boolean;
  rainbow_privileged: boolean;
  rainbow_until: string | null;
  rainbow_prize_days: number;
};

const NICKNAME_MAX = 20;

export default function ProfileEditor({ initial }: { initial: ProfileData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState(initial.nickname);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url);
  const [rainbowEnabled, setRainbowEnabled] = useState(initial.rainbow_enabled);
  const [rainbowUntil, setRainbowUntil] = useState(initial.rainbow_until);
  const [rainbowPrizeDays, setRainbowPrizeDays] = useState(initial.rainbow_prize_days);
  const [rainbowNow, setRainbowNow] = useState(0);
  const [rainbowBusy, setRainbowBusy] = useState(false);
  const [rainbowMsg, setRainbowMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"success" | "error" | null>(null);

  // 打开弹窗时重置字段
  function handleOpen() {
    setNickname(initial.nickname);
    setAvatarUrl(initial.avatar_url);
    setRainbowEnabled(initial.rainbow_enabled);
    setRainbowUntil(initial.rainbow_until);
    setRainbowPrizeDays(initial.rainbow_prize_days);
    setRainbowNow(Date.now());
    setRainbowBusy(false);
    setRainbowMsg(null);
    setErrors({});
    setMsg(null);
    setMsgType(null);
    setOpen(true);
  }

  const validateLocal = (): Record<string, string> => {
    const e: Record<string, string> = {};

    const nn = nickname.trim();
    if (nn.length < 1 || nn.length > NICKNAME_MAX) {
      e.nickname = `昵称长度 1-${NICKNAME_MAX} 字符`;
    }
    if (/[\x00-\x1f]/.test(nn)) e.nickname = "昵称含非法字符";

    if (avatarUrl.trim() && !/^https?:\/\/[^\s"<>]+$/i.test(avatarUrl.trim())) {
      e.avatar_url = "头像仅支持 http(s) 链接";
    }

    return e;
  };

  const hasChanges =
    nickname !== initial.nickname ||
    avatarUrl !== initial.avatar_url;

  const canSubmit =
    !loading &&
    hasChanges &&
    Object.keys(validateLocal()).length === 0;

  const rainbowRemainingDays = rainbowUntil
    ? Math.max(0, Math.ceil((new Date(rainbowUntil).getTime() - rainbowNow) / 86400000))
    : 0;
  const hasRainbowAccess = initial.rainbow_privileged || rainbowRemainingDays > 0;

  async function toggleRainbow() {
    if (rainbowBusy) return;
    const next = !rainbowEnabled;
    setRainbowBusy(true);
    setRainbowMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rainbow_enabled: next }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setRainbowEnabled(next);
        if (data.rainbow_until) setRainbowUntil(data.rainbow_until);
        router.refresh();
      } else {
        setRainbowMsg(data.errors?.rainbow_enabled ?? data.message ?? "操作失败");
      }
    } catch {
      setRainbowMsg("网络错误");
    } finally {
      setRainbowBusy(false);
    }
  }

  async function claimRainbowPrizes() {
    if (rainbowBusy) return;
    setRainbowBusy(true);
    setRainbowMsg(null);
    try {
      const res = await fetch("/api/profile/rainbow/claim", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) {
        if (data.rainbowUntil) setRainbowUntil(data.rainbowUntil);
        setRainbowPrizeDays(0);
        setRainbowEnabled(true);
        setRainbowMsg(`已获得 ${data.claimedDays} 天彩虹昵称`);
        router.refresh();
      } else {
        setRainbowMsg(data.message ?? "领取失败");
      }
    } catch {
      setRainbowMsg("网络错误");
    } finally {
      setRainbowBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const localErrors = validateLocal();
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    setLoading(true);
    setErrors({});
    setMsg(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          avatar_url: avatarUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.errors) {
          setErrors(data.errors);
        }
        setMsg(data.message ?? "保存失败");
        setMsgType("error");
        return;
      }

      setMsg("✓ 已保存");
      setMsgType("success");

      // 刷新页面以反映最新资料（server component 会从 DB 重取）
      // 延迟 500ms 让用户看到保存成功提示
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (err) {
      setMsg("网络错误：" + (err as Error).message);
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700 active:scale-95"
      >
        编辑资料
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-900">编辑资料</h3>
            <p className="mt-1 text-xs text-slate-500">保存后立即生效。</p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* 昵称 */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  昵称 <span className="text-slate-400">({nickname.trim().length}/{NICKNAME_MAX})</span>
                </label>
                <input
                  type="text"
                  value={nickname}
                  maxLength={NICKNAME_MAX}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    setErrors((prev) => ({ ...prev, nickname: "" }));
                  }}
                  placeholder="1-20 字符"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
                    errors.nickname
                      ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                      : "border-slate-200 focus:border-[#2563eb] focus:ring-[#2563eb]/20"
                  }`}
                />
                {errors.nickname && (
                  <p className="mt-1 text-xs text-red-600">{errors.nickname}</p>
                )}
              </div>

              {/* 头像 */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  头像 URL（http 或 https）
                </label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => {
                    setAvatarUrl(e.target.value);
                    setErrors((prev) => ({ ...prev, avatar_url: "" }));
                  }}
               
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
                    errors.avatar_url
                      ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                      : "border-slate-200 focus:border-[#2563eb] focus:ring-[#2563eb]/20"
                  }`}
                />
                {errors.avatar_url && (
                  <p className="mt-1 text-xs text-red-600">{errors.avatar_url}</p>
                )}
                {avatarUrl && !errors.avatar_url && (
                  <div className="mt-2">
                    <p className="text-[11px] text-slate-400 mb-1">预览：</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarUrl}
                      alt="预览"
                      className="size-16 rounded-full object-cover border border-slate-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        setErrors((prev) => ({ ...prev, avatar_url: "图片加载失败，请检查链接" }));
                      }}
                    />
                  </div>
                )}
              </div>

              {/* 彩虹昵称 */}
              <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-rose-50/60 via-amber-50/50 to-violet-50/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                      <span className="size-2 rounded-full bg-gradient-to-r from-rose-400 via-amber-400 to-violet-500" />
                      彩虹昵称
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                      {initial.rainbow_privileged
                        ? "你的角色可永久使用"
                        : hasRainbowAccess
                          ? `剩余 ${rainbowRemainingDays} 天`
                          : rainbowPrizeDays > 0
                            ? `有 ${rainbowPrizeDays} 天奖品待使用`
                            : "通过祈愿获得彩虹ID奖品后可开启"}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={rainbowEnabled}
                    aria-label="彩虹昵称"
                    disabled={!hasRainbowAccess || rainbowBusy}
                    onClick={toggleRainbow}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                      rainbowEnabled
                        ? "bg-gradient-to-r from-rose-400 via-amber-400 to-violet-500"
                        : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        rainbowEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {(rainbowMsg || (!initial.rainbow_privileged && rainbowPrizeDays > 0)) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {!initial.rainbow_privileged && rainbowPrizeDays > 0 && (
                      <button
                        type="button"
                        onClick={claimRainbowPrizes}
                        disabled={rainbowBusy}
                        className="rounded-full bg-gradient-to-r from-rose-500 via-amber-500 to-violet-500 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                      >
                        {rainbowBusy ? "处理中…" : `使用 ${rainbowPrizeDays} 天奖品`}
                      </button>
                    )}
                    {rainbowMsg && <span className="text-[11px] text-slate-500">{rainbowMsg}</span>}
                  </div>
                )}

                {rainbowEnabled && hasRainbowAccess && nickname.trim() && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    预览：
                    <span className="ml-1 font-semibold text-slate-700">
                      <UserName name={nickname.trim()} rainbow />
                    </span>
                  </p>
                )}
              </div>

              {/* 提示消息 */}
              {msg && msgType && (
                <div
                  className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                    msgType === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {msg}
                </div>
              )}

              {/* 按钮 */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => !loading && setOpen(false)}
                  disabled={loading}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
                >
                  {loading ? "保存中…" : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
