"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Check,
  Image as ImageIcon,
  Languages,
  Palette,
  Paperclip,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLocale } from "@/components/language-provider";
import { useTheme } from "@/components/theme-provider";
import { backgroundPreviewStyle } from "@/lib/backgrounds";

export type SettingsProfile = {
  nickname: string;
  avatarUrl: string;
  rainbowEnabled: boolean;
  rainbowPrivileged: boolean;
  rainbowUntil: string | null;
  rainbowPrizeDays: number;
};

type TabKey = "profile" | "appearance" | "language" | "security" | "danger";

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "profile", label: "个人资料", icon: User },
  { key: "appearance", label: "外观", icon: Palette },
  { key: "language", label: "语言", icon: Languages },
  { key: "security", label: "账号安全", icon: ShieldCheck },
  { key: "danger", label: "危险操作", icon: Trash2 },
];

const CARD =
  "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]";
const PRIMARY_BUTTON =
  "inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50";

const AVATAR_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

function remainingRainbowDays(until: string | null): number {
  if (!until) return 0;
  const t = new Date(until).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.ceil((t - Date.now()) / 86400000));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function SettingsClient({ initialProfile }: { initialProfile: SettingsProfile }) {
  const [tab, setTab] = useState<TabKey>("profile");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">账户设置</h1>
      </header>

      <div className="grid gap-6 min-[900px]:grid-cols-[220px_minmax(0,1fr)] min-[900px]:items-start">
        <nav aria-label="设置分类" className="min-[900px]:sticky min-[900px]:top-24">
          <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm shadow-slate-900/[0.03] min-[900px]:flex-col">
            {TABS.map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors min-[900px]:w-full min-[900px]:px-3.5 ${
                    active
                      ? "bg-brand-600 text-white shadow-sm shadow-brand-600/20"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.8} />
                  {label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0">
          {tab === "profile" && <ProfilePanel profile={initialProfile} />}
          {tab === "appearance" && <AppearancePanel />}
          {tab === "language" && <LanguagePanel />}
          {tab === "security" && <SecurityPanel />}
          {tab === "danger" && <DangerPanel />}
        </div>
      </div>
    </div>
  );
}

function ProfilePanel({ profile }: { profile: SettingsProfile }) {
  const router = useRouter();

  const [savedName, setSavedName] = useState(profile.nickname);
  const [name, setName] = useState(profile.nickname);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [savedAvatar, setSavedAvatar] = useState(profile.avatarUrl);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [brokenAvatar, setBrokenAvatar] = useState("");
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarUrlInput, setAvatarUrlInput] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarDragging, setAvatarDragging] = useState(false);
  const [avatarDialogError, setAvatarDialogError] = useState("");
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const avatarDialogRef = useRef<HTMLDivElement>(null);

  const [rainbowEnabled, setRainbowEnabled] = useState(profile.rainbowEnabled);
  const [rainbowUntil, setRainbowUntil] = useState(profile.rainbowUntil);
  const [rainbowPrizeDays, setRainbowPrizeDays] = useState(profile.rainbowPrizeDays);
  const [rainbowBusy, setRainbowBusy] = useState(false);
  const [rainbowClaiming, setRainbowClaiming] = useState(false);
  const [rainbowMsg, setRainbowMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const rainbowDesiredRef = useRef(profile.rainbowEnabled);
  const rainbowSavedRef = useRef(profile.rainbowEnabled);
  const rainbowSavingRef = useRef(false);

  const resetAvatarDialog = useCallback(() => {
    setAvatarDialogOpen(false);
    setAvatarDialogError("");
    setAvatarUrlInput("");
    setAvatarFile(null);
    setAvatarDragging(false);
    if (avatarFileRef.current) avatarFileRef.current.value = "";
  }, []);

  const closeAvatarDialog = useCallback(() => {
    if (!avatarBusy) resetAvatarDialog();
  }, [avatarBusy, resetAvatarDialog]);

  useEffect(() => {
    if (!avatarDialogOpen) return;
    avatarDialogRef.current?.focus();
  }, [avatarDialogOpen]);

  useEffect(() => {
    if (!avatarDialogOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [avatarDialogOpen]);

  useEffect(() => {
    if (!avatarDialogOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAvatarDialog();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [avatarDialogOpen, closeAvatarDialog]);

  const trimmedName = name.trim();
  const nameError =
    trimmedName.length === 0
      ? "请输入用户名"
      : trimmedName.length > 20
        ? "用户名最多 20 个字符"
        : /[\x00-\x1f]/.test(trimmedName)
          ? "用户名含非法字符"
          : "";
  const canSaveName = trimmedName !== savedName && !nameError && !nameSaving;

  const avatarPreview = savedAvatar;
  const showAvatarImage = !!avatarPreview && brokenAvatar !== avatarPreview;
  const avatarInitial = (trimmedName || savedName).slice(0, 1).toUpperCase() || "?";

  const remainingDays = remainingRainbowDays(rainbowUntil);
  const hasRainbowAccess = profile.rainbowPrivileged || remainingDays > 0;
  const rainbowStatus = profile.rainbowPrivileged
    ? "永久可用"
    : remainingDays > 0
      ? `剩余 ${remainingDays} 天`
      : rainbowPrizeDays > 0
        ? `${rainbowPrizeDays} 天奖品待使用`
        : "暂不可用";

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!canSaveName) return;
    setNameSaving(true);
    setNameMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: trimmedName }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        errors?: Record<string, string>;
      };
      if (!res.ok || !data.ok) {
        setNameMsg({
          type: "error",
          text: data.errors?.nickname ?? data.message ?? "保存失败",
        });
        return;
      }
      setSavedName(trimmedName);
      setNameMsg({ type: "success", text: "已保存" });
      router.refresh();
    } catch {
      setNameMsg({ type: "error", text: "网络错误，请稍后重试" });
    } finally {
      setNameSaving(false);
    }
  }

  function openAvatarDialog() {
    if (avatarBusy) return;
    setAvatarError("");
    setAvatarDialogError("");
    setAvatarUrlInput("");
    setAvatarFile(null);
    setAvatarDragging(false);
    if (avatarFileRef.current) avatarFileRef.current.value = "";
    setAvatarDialogOpen(true);
  }

  function selectAvatarFile(file: File) {
    if (!AVATAR_TYPES.has(file.type)) {
      setAvatarDialogError("仅支持 JPG / PNG / WebP");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarDialogError("图片不能超过 5MB");
      return;
    }
    setAvatarDialogError("");
    setAvatarFile(file);
    setAvatarUrlInput("");
  }

  function handleAvatarFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) selectAvatarFile(file);
  }

  function clearAvatarFile() {
    setAvatarFile(null);
    setAvatarDialogError("");
    if (avatarFileRef.current) avatarFileRef.current.value = "";
  }

  function handleAvatarDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setAvatarDragging(false);
    if (avatarBusy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) selectAvatarFile(file);
  }

  async function applyAvatar(e: React.FormEvent) {
    e.preventDefault();
    if (avatarBusy) return;

    const url = avatarUrlInput.trim();
    if (!avatarFile && !url) {
      setAvatarDialogError("请选择本地图片或填写图片链接");
      return;
    }
    if (
      !avatarFile &&
      url &&
      !/^https?:\/\/[^\s"<>]+$/i.test(url) &&
      !/^\/uploads\/avatars\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp)$/i.test(url)
    ) {
      setAvatarDialogError("请输入 http(s) 图片链接");
      return;
    }

    setAvatarBusy(true);
    setAvatarDialogError("");
    setAvatarError("");
    try {
      let nextUrl = url;
      if (avatarFile) {
        const formData = new FormData();
        formData.append("file", avatarFile);
        const uploadRes = await fetch("/api/upload?kind=avatar", {
          method: "POST",
          body: formData,
        });
        const uploadData = (await uploadRes.json().catch(() => ({}))) as {
          ok?: boolean;
          message?: string;
          url?: string;
        };
        if (!uploadRes.ok || !uploadData.ok || !uploadData.url) {
          setAvatarDialogError(uploadData.message ?? "图片上传失败");
          return;
        }
        nextUrl = uploadData.url;
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: nextUrl }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        errors?: Record<string, string>;
      };
      if (!res.ok || !data.ok) {
        setAvatarDialogError(data.errors?.avatar_url ?? data.message ?? "保存失败");
        return;
      }

      setSavedAvatar(nextUrl);
      setBrokenAvatar("");
      resetAvatarDialog();
      router.refresh();
    } catch {
      setAvatarDialogError("网络错误，请稍后重试");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function flushRainbow() {
    if (rainbowSavingRef.current) return;
    rainbowSavingRef.current = true;
    setRainbowBusy(true);
    try {
      while (rainbowDesiredRef.current !== rainbowSavedRef.current) {
        const target = rainbowDesiredRef.current;
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rainbow_enabled: target }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          message?: string;
          errors?: Record<string, string>;
          rainbow_until?: string;
        };
        if (!res.ok || !data.ok) {
          const fallback = rainbowSavedRef.current;
          rainbowDesiredRef.current = fallback;
          setRainbowEnabled(fallback);
          setRainbowMsg({
            type: "error",
            text: data.errors?.rainbow_enabled ?? data.message ?? "操作失败",
          });
          return;
        }
        rainbowSavedRef.current = target;
        if (data.rainbow_until) setRainbowUntil(data.rainbow_until);
      }
    } catch {
      const fallback = rainbowSavedRef.current;
      rainbowDesiredRef.current = fallback;
      setRainbowEnabled(fallback);
      setRainbowMsg({ type: "error", text: "网络错误，请稍后重试" });
    } finally {
      rainbowSavingRef.current = false;
      setRainbowBusy(false);
      if (rainbowDesiredRef.current !== rainbowSavedRef.current) {
        void flushRainbow();
      }
    }
  }

  function toggleRainbow() {
    if (!hasRainbowAccess || rainbowClaiming) return;
    const next = !rainbowDesiredRef.current;
    rainbowDesiredRef.current = next;
    setRainbowEnabled(next);
    setRainbowMsg(null);
    void flushRainbow();
  }

  async function claimRainbowPrizes() {
    if (rainbowBusy) return;
    setRainbowClaiming(true);
    setRainbowBusy(true);
    setRainbowMsg(null);
    try {
      const res = await fetch("/api/profile/rainbow/claim", { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        claimedDays?: number;
        rainbowUntil?: string;
      };
      if (!res.ok || !data.ok) {
        setRainbowMsg({ type: "error", text: data.message ?? "领取失败" });
        return;
      }
      if (data.rainbowUntil) setRainbowUntil(data.rainbowUntil);
      setRainbowPrizeDays(0);
      rainbowDesiredRef.current = true;
      rainbowSavedRef.current = true;
      setRainbowEnabled(true);
      setRainbowMsg({
        type: "success",
        text: `已获得 ${data.claimedDays ?? 0} 天彩虹昵称`,
      });
    } catch {
      setRainbowMsg({ type: "error", text: "网络错误，请稍后重试" });
    } finally {
      setRainbowBusy(false);
      setRainbowClaiming(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className={CARD}>
        <div className="flex items-center gap-4 p-5 sm:p-6">
          {showAvatarImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarPreview}
              alt="头像"
              className="size-20 shrink-0 rounded-full border border-slate-200 object-cover"
              onError={() => setBrokenAvatar(avatarPreview)}
            />
          ) : (
            <span className="grid size-20 shrink-0 place-items-center rounded-full bg-brand-600 text-xl font-semibold text-white">
              {avatarInitial}
            </span>
          )}

          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">头像</h2>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={openAvatarDialog}
                disabled={avatarBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="size-3.5" strokeWidth={1.8} />
                {avatarBusy ? "处理中…" : savedAvatar ? "更换头像" : "上传头像"}
              </button>
            </div>
            {avatarError && (
              <p aria-live="polite" className="mt-2 text-xs text-red-600">
                {avatarError}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className={CARD}>
        <div className="p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">用户名</h2>

          <form onSubmit={saveName} className="mt-3 flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="nickname" className="sr-only">
                用户名
              </label>
              <input
                id="nickname"
                type="text"
                value={name}
                maxLength={20}
                autoComplete="nickname"
                onChange={(e) => {
                  setName(e.target.value);
                  setNameMsg(null);
                }}
                placeholder="用户名"
                aria-invalid={!!nameError}
                className={`h-[46px] w-full rounded-xl border bg-slate-50/70 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 ${
                  nameError
                    ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                    : "border-slate-200 focus:border-brand-500 focus:ring-brand-500/10"
                }`}
              />
              {(nameMsg || nameError) && (
                <p
                  aria-live="polite"
                  className={`mt-2 text-xs ${
                    nameMsg?.type === "success" ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {nameMsg?.text ?? nameError}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={!canSaveName}
              className={`${PRIMARY_BUTTON} h-[46px] shrink-0`}
            >
              {nameSaving ? "保存中…" : "保存"}
            </button>
          </form>
        </div>
      </section>

      <section className={CARD}>
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <Sparkles className="size-4 text-brand-500" />
                彩虹昵称
              </h2>
              <p className="mt-1 text-xs text-slate-500">{rainbowStatus}</p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={rainbowEnabled}
              aria-label="彩虹昵称"
              aria-busy={rainbowBusy}
              disabled={!hasRainbowAccess || rainbowClaiming}
              onClick={toggleRainbow}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-80 ${
                rainbowEnabled ? "bg-brand-600 shadow-sm shadow-brand-600/20" : "bg-slate-200"
              }`}
            >
              <span
                className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  rainbowEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {(rainbowPrizeDays > 0 || rainbowMsg) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              {rainbowPrizeDays > 0 && (
                <button
                  type="button"
                  onClick={claimRainbowPrizes}
                  disabled={rainbowBusy}
                  className="rounded-full bg-gradient-to-r from-rose-500 via-amber-500 to-violet-500 px-3 py-1 text-[11px] font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                >
                  {rainbowBusy ? "处理中…" : `使用 ${rainbowPrizeDays} 天奖品`}
                </button>
              )}
              {rainbowMsg && (
                <span
                  className={`text-[11px] ${
                    rainbowMsg.type === "error" ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {rainbowMsg.text}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {avatarDialogOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeAvatarDialog();
          }}
        >
          <div
            ref={avatarDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-dialog-title"
            aria-busy={avatarBusy}
            tabIndex={-1}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-[560px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 outline-none"
          >
            <div className="sticky top-0 z-10 flex items-center justify-center border-b border-slate-100 bg-white px-6 py-4">
              <h2 id="avatar-dialog-title" className="text-lg font-semibold text-slate-900">
                {savedAvatar ? "更换头像" : "上传头像"}
              </h2>
              <button
                type="button"
                onClick={closeAvatarDialog}
                disabled={avatarBusy}
                aria-label="关闭"
                className="absolute right-4 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="size-5" strokeWidth={1.8} />
              </button>
            </div>

            <form onSubmit={applyAvatar} noValidate>
              <div className="px-6 py-5">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="avatar-url" className="text-sm font-medium text-slate-700">
                    图片链接
                  </label>
                </div>
                <input
                  id="avatar-url"
                  type="url"
                  inputMode="url"
                  value={avatarUrlInput}
                  onChange={(e) => {
                    setAvatarUrlInput(e.target.value);
                    setAvatarDialogError("");
                    if (e.target.value.trim() && avatarFile) {
                      setAvatarFile(null);
                      if (avatarFileRef.current) avatarFileRef.current.value = "";
                    }
                  }}
                  disabled={avatarBusy}

                  autoComplete="off"
                  spellCheck={false}
                  className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-400/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                />

                <p className="mt-5 text-sm font-medium text-slate-700">或上传本地图片</p>
                <label
                  htmlFor="avatar-file-input"
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!avatarBusy) setAvatarDragging(true);
                  }}
                  onDragLeave={(e) => {
                    const nextTarget = e.relatedTarget;
                    if (!(nextTarget instanceof Node) || !e.currentTarget.contains(nextTarget)) {
                      setAvatarDragging(false);
                    }
                  }}
                  onDrop={handleAvatarDrop}
                  className={`mt-2 flex min-h-[150px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-8 text-center transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/10 ${
                    avatarDragging
                      ? "border-brand-400 bg-brand-50/60"
                      : "border-slate-300 bg-slate-50/40 hover:border-slate-400 hover:bg-slate-50"
                  } ${avatarBusy ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
                >
                  <input
                    id="avatar-file-input"
                    ref={avatarFileRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleAvatarFileInput}
                    disabled={avatarBusy}
                    className="sr-only"
                  />
                  <ImageIcon className="size-9 text-brand-500" strokeWidth={1.5} />
                  <span className="text-sm font-medium text-slate-700">
                    点击或拖动图片到此处上传
                  </span>
                </label>

                {avatarFile && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <Paperclip className="size-3.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                      {avatarFile.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatFileSize(avatarFile.size)}
                    </span>
                    <button
                      type="button"
                      onClick={clearAvatarFile}
                      disabled={avatarBusy}
                      aria-label="移除已选图片"
                      className="grid size-6 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}

                {avatarDialogError && (
                  <p
                    role="alert"
                    className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600"
                  >
                    {avatarDialogError}
                  </p>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={avatarBusy || (!avatarFile && !avatarUrlInput.trim())}
                    className="inline-flex min-w-[88px] items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {avatarBusy ? (
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
      )}
    </div>
  );
}

function AppearancePanel() {
  const {
    theme: activeTheme,
    setTheme,
    themes,
    background: activeBackground,
    setBackground,
    backgrounds,
  } = useTheme();

  return (
    <div className="space-y-4">
      <section className={CARD}>
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">颜色风格</h2>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {themes.map((theme) => {
              const active = theme.id === activeTheme;
              return (
                <button
                  key={theme.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTheme(theme.id)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-brand-300 bg-brand-50/70 ring-2 ring-brand-500/15"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`size-10 shrink-0 rounded-lg bg-gradient-to-br ${theme.swatch} shadow-sm`}
                  />
                  <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">
                    {theme.label}
                  </span>
                  {active && <Check className="size-4 shrink-0 text-brand-700" strokeWidth={2.4} />}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className={CARD}>
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">页面背景</h2>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {backgrounds.map((background) => {
              const active = background.id === activeBackground;
              return (
                <button
                  key={background.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBackground(background.id)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-brand-300 bg-brand-50/70 ring-2 ring-brand-500/15"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span
                    aria-hidden
                    className="size-10 shrink-0 rounded-lg border border-slate-200/80 shadow-sm"
                    style={backgroundPreviewStyle(background)}
                  />
                  <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">
                    {background.label}
                  </span>
                  {active && <Check className="size-4 shrink-0 text-brand-700" strokeWidth={2.4} />}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function LanguagePanel() {
  const { locale: activeLocale, setLocale, locales } = useLocale();

  return (
    <section className={CARD}>
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">界面语言</h2>
      </div>

      <div className="p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {locales.map((item) => {
            const active = item.id === activeLocale;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setLocale(item.id)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  active
                    ? "border-brand-300 bg-brand-50/70 ring-2 ring-brand-500/15"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">
                  {item.label}
                </span>
                {active && <Check className="size-4 shrink-0 text-brand-700" strokeWidth={2.4} />}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SecurityPanel() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  return (
    <section className={CARD}>
      <div className="divide-y divide-slate-100">
        <div className="flex items-center justify-between gap-4 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">两步验证（2FA）</h2>
          <Link href="/settings/security" className={SECONDARY_BUTTON}>
            管理
          </Link>
        </div>

        <div className="flex items-center justify-between gap-4 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">登录状态</h2>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className={SECONDARY_BUTTON}
          >
            {loggingOut ? "退出中…" : "退出登录"}
          </button>
        </div>
      </div>
    </section>
  );
}

function DangerPanel() {
  return (
    <section className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm shadow-slate-900/[0.03]">
      <div className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-red-900">注销账号</h2>
        <p className="mt-1 text-sm text-slate-500">此操作不可逆，账号和所有数据将被永久删除。</p>
        <Link
          href="/settings/delete"
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-[0.98]"
        >
          注销账号
        </Link>
      </div>
    </section>
  );
}
