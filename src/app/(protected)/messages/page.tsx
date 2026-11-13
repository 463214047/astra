"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Inbox,
  MessageCircle,
  RefreshCw,
  Send,
  X,
  type LucideIcon,
} from "lucide-react";
import { UserName } from "@/components/rainbow-name";
import Editor from "@/components/editor";
import { isRichText, richTextToPlainText, sanitizeRichHtml } from "@/lib/rich-text";

type TabKey = "notifications" | "inbox" | "outbox";

type Notification = {
  id: string;
  type: "system" | "reply";
  title: string;
  content: string | null;
  source_type: string | null;
  source_id: string | null;
  source_title: string | null;
  reply_author: string | null;
  reply_avatar: string | null;
  is_read: boolean;
  created_at: string;
};

type InboxMessage = {
  id: string;
  conversation_id: string;
  sender_email: string;
  sender_name: string;
  sender_avatar: string | null;
  sender_rainbow: boolean;
  content: string;
  created_at: string;
  unread: boolean;
};

type OutboxMessage = {
  id: string;
  recipient_email: string;
  recipient_name: string;
  recipient_avatar: string | null;
  recipient_rainbow: boolean;
  content: string;
  created_at: string;
  seen: boolean;
};

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "notifications", label: "通知", icon: Bell },
  { key: "inbox", label: "收件箱", icon: Inbox },
  { key: "outbox", label: "发件箱", icon: Send },
];

const EMPTY_COPY: Record<TabKey, { title: string; description: string; icon: LucideIcon }> = {
  notifications: {
    title: "暂无通知",
    description: "新的系统通知和回复会显示在这里",
    icon: Bell,
  },
  inbox: {
    title: "暂无收件",
    description: "其他人发给你的消息会显示在这里",
    icon: Inbox,
  },
  outbox: {
    title: "暂无发件",
    description: "你发出的消息会显示在这里",
    icon: Send,
  },
};

/** 相对时间格式化 */
function timeAgo(iso: string): string {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const diff = Math.max(0, (Date.now() - timestamp) / 1000);
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;

  const date = new Date(timestamp);
  return date.toLocaleDateString("zh-CN");
}

type MessageData = {
  notifications: Notification[];
  notificationUnread: number;
  inbox: InboxMessage[];
  outbox: OutboxMessage[];
};

/** 拉取消息中心数据，不直接修改组件状态 */
async function requestMessages(): Promise<MessageData> {
  const [notifRes, msgRes] = await Promise.all([
    fetch("/api/notifications", { cache: "no-store" }),
    fetch("/api/messages", { cache: "no-store" }),
  ]);

  const nd = (await notifRes.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    items?: Notification[];
    unread?: { total?: number };
  };
  const md = (await msgRes.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    inbox?: InboxMessage[];
    outbox?: OutboxMessage[];
  };

  if (!notifRes.ok || !nd.ok || !msgRes.ok || !md.ok) {
    throw new Error(nd.message ?? md.message ?? "消息加载失败");
  }

  return {
    notifications: nd.items ?? [],
    notificationUnread: Number(nd.unread?.total ?? 0),
    inbox: md.inbox ?? [],
    outbox: md.outbox ?? [],
  };
}

export default function MessagesPage() {
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>("notifications");
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  const [outbox, setOutbox] = useState<OutboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [activeInbox, setActiveInbox] = useState<InboxMessage | null>(null);

  const applyData = useCallback((data: MessageData) => {
    setNotifs(data.notifications);
    setNotifUnread(data.notificationUnread);
    setInbox(data.inbox);
    setOutbox(data.outbox);
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const data = await requestMessages();
      applyData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "消息加载失败");
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  useEffect(() => {
    let active = true;

    requestMessages()
      .then((data) => {
        if (active) applyData(data);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "消息加载失败");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applyData]);

  function handleRetry() {
    setLoading(true);
    setError(null);
    void loadMessages();
  }

  /** 全部标记已读 */
  async function handleReadAll() {
    if (markingAll) return;
    setMarkingAll(true);
    setActionError(null);

    try {
      const [notificationsRes, messagesRes] = await Promise.all([
        fetch("/api/notifications/read-all", { method: "PATCH" }),
        fetch("/api/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ all: true }),
        }),
      ]);
      if (!notificationsRes.ok || !messagesRes.ok) throw new Error("标记失败");

      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setNotifUnread(0);
      setInbox((prev) => prev.map((m) => ({ ...m, unread: false })));
      window.dispatchEvent(new Event("ds:unread-refresh"));
      router.refresh();
    } catch {
      setActionError("操作失败，请稍后重试");
    } finally {
      setMarkingAll(false);
    }
  }

  /** 单条通知标记已读 */
  async function markNotifRead(notification: Notification) {
    if (notification.is_read) return;
    setActionError(null);

    try {
      const res = await fetch(`/api/notifications/${notification.id}/read`, {
        method: "PATCH",
      });
      if (!res.ok) {
        setActionError("标记已读失败，请稍后重试");
        return;
      }

      setNotifs((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)),
      );
      setNotifUnread((prev) => Math.max(0, prev - 1));
      window.dispatchEvent(new Event("ds:unread-refresh"));
      router.refresh();
    } catch {
      setActionError("标记已读失败，请稍后重试");
    }
  }

  /** 单条收件标记已读 */
  async function markInboxRead(message: InboxMessage) {
    if (!message.unread) return;
    setActionError(null);

    try {
      const res = await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: message.conversation_id,
          read_at: message.created_at,
        }),
      });
      if (!res.ok) {
        setActionError("标记已读失败，请稍后重试");
        return;
      }

      setInbox((prev) => prev.map((m) => (m.id === message.id ? { ...m, unread: false } : m)));
      window.dispatchEvent(new Event("ds:unread-refresh"));
      router.refresh();
    } catch {
      setActionError("标记已读失败，请稍后重试");
    }
  }

  const activeTab = TABS.find((item) => item.key === tab) ?? TABS[0];
  const ActiveIcon = activeTab.icon;
  const inboxUnread = inbox.reduce((sum, message) => sum + (message.unread ? 1 : 0), 0);
  const totalUnread = notifUnread + inboxUnread;
  const itemCount =
    tab === "notifications" ? notifs.length : tab === "inbox" ? inbox.length : outbox.length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">消息中心</h1>

        {!loading && totalUnread > 0 && (
          <button
            type="button"
            onClick={handleReadAll}
            disabled={markingAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm shadow-slate-900/[0.02] transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCheck className="size-4" strokeWidth={1.8} />
            {markingAll ? "处理中…" : "全部已读"}
          </button>
        )}
      </header>

      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
        >
          {actionError}
        </div>
      )}

      <div className="grid gap-5 min-[900px]:grid-cols-[220px_minmax(0,1fr)] min-[900px]:items-start min-[900px]:gap-6">
        <nav aria-label="消息分类" className="min-[900px]:sticky min-[900px]:top-24">
          <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm shadow-slate-900/[0.03] min-[900px]:flex-col [[data-background=tohru]_&]:bg-transparent">
            {TABS.map(({ key, label, icon: Icon }) => {
              const active = tab === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTab(key);
                    setActionError(null);
                  }}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/40 min-[900px]:w-full min-[900px]:justify-start min-[900px]:px-3.5 ${
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

        <section
          aria-busy={loading}
          aria-label="消息列表"
          className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] [[data-background=tohru]_&]:bg-transparent"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <ActiveIcon className="size-4 shrink-0 text-slate-400" strokeWidth={1.8} />
              <h2 className="text-sm font-semibold text-slate-900">{activeTab.label}</h2>
            </div>
            {!loading && itemCount > 0 && (
              <span className="shrink-0 text-[11px] text-slate-400">共 {itemCount} 条</span>
            )}
          </div>

          {loading ? (
            <FeedSkeleton />
          ) : error ? (
            <ErrorState message={error} onRetry={handleRetry} />
          ) : itemCount === 0 ? (
            <EmptyState tab={tab} />
          ) : tab === "notifications" ? (
            <ul className="divide-y divide-slate-100">
              {notifs.map((notification) => (
                <NotificationRow
                  key={`n-${notification.id}`}
                  notification={notification}
                  onMarkRead={markNotifRead}
                  onNavigate={(href) => router.push(href)}
                />
              ))}
            </ul>
          ) : tab === "inbox" ? (
            <ul className="divide-y divide-slate-100">
              {inbox.map((message) => (
                <InboxRow
                  key={`i-${message.id}`}
                  message={message}
                  onRead={markInboxRead}
                  onOpen={(m) => setActiveInbox(m)}
                />
              ))}
            </ul>
          ) : (
            <ul className="divide-y divide-slate-100">
              {outbox.map((message) => (
                <OutboxRow key={`o-${message.id}`} message={message} />
              ))}
            </ul>
          )}
        </section>
      </div>

      {activeInbox && (
        <InboxDetailDialog
          message={activeInbox}
          onClose={() => setActiveInbox(null)}
          onReplied={() => void loadMessages()}
        />
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex items-start gap-3.5 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:px-6"
        >
          <div className="size-11 shrink-0 animate-pulse rounded-full bg-slate-100" />
          <div className="min-w-0 flex-1 space-y-2.5 pt-0.5">
            <div className="h-3.5 w-2/5 animate-pulse rounded-full bg-slate-100" />
            <div className="h-3 w-4/5 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="px-6 py-14 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100">
        <RefreshCw className="size-6" strokeWidth={1.6} />
      </span>
      <p className="mt-4 text-sm font-semibold text-slate-700">加载失败</p>
      <p className="mx-auto mt-1 max-w-sm break-words text-xs leading-5 text-slate-400">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <RefreshCw className="size-3.5" strokeWidth={1.8} />
        重试
      </button>
    </div>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  const { title, description, icon: Icon } = EMPTY_COPY[tab];

  return (
    <div className="px-6 py-16 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-100">
        <Icon className="size-6" strokeWidth={1.6} />
      </span>
      <p className="mt-4 text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function NotificationRow({
  notification,
  onMarkRead,
  onNavigate,
}: {
  notification: Notification;
  onMarkRead: (notification: Notification) => Promise<void>;
  onNavigate: (href: string) => void;
}) {
  const isReply = notification.type === "reply";
  const href =
    notification.source_type === "post" && notification.source_id
      ? `/posts/${notification.source_id}`
      : notification.source_type === "work" && notification.source_id
        ? `/works/${notification.source_id}`
        : null;

  async function handleClick() {
    if (!notification.is_read) await onMarkRead(notification);
    if (href) onNavigate(href);
  }

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className={`group flex w-full items-start gap-3.5 px-5 py-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/30 sm:px-6 ${
          notification.is_read ? "hover:bg-slate-50" : "bg-brand-50/30 hover:bg-brand-50/60"
        }`}
      >
        <span className="relative mt-0.5 shrink-0">
          {isReply && notification.reply_avatar ? (
            <Image
              src={notification.reply_avatar}
              alt={notification.reply_author ?? "回复"}
              width={44}
              height={44}
              unoptimized
              className="size-11 rounded-full object-cover ring-2 ring-white"
            />
          ) : (
            <span
              className={`grid size-11 place-items-center rounded-2xl ${
                isReply
                  ? "bg-brand-50 text-brand-700 ring-1 ring-brand-100"
                  : "bg-brand-50 text-brand-700 ring-1 ring-brand-100"
              }`}
            >
              {isReply ? (
                <MessageCircle className="size-5" strokeWidth={1.8} />
              ) : (
                <Bell className="size-5" strokeWidth={1.8} />
              )}
            </span>
          )}
          {!notification.is_read && (
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-brand-500 ring-2 ring-white" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span
              className={`truncate text-sm leading-6 ${
                notification.is_read ? "font-medium text-slate-700" : "font-semibold text-slate-900"
              }`}
            >
              {notification.title}
            </span>
            <time
              dateTime={notification.created_at}
              className="shrink-0 pt-0.5 text-[11px] text-slate-400"
            >
              {timeAgo(notification.created_at)}
            </time>
          </span>

          {notification.content && (
            <span
              className={`mt-0.5 line-clamp-2 text-xs leading-5 ${
                notification.is_read ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {notification.content}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function Avatar({ name, avatar }: { name: string; avatar: string | null }) {
  if (avatar) {
    return (
      <Image
        src={avatar}
        alt={name}
        width={44}
        height={44}
        unoptimized
        className="size-11 rounded-full object-cover ring-2 ring-white"
      />
    );
  }

  return (
    <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-brand-100 via-brand-50 to-brand-100 text-sm font-semibold text-slate-600 ring-2 ring-white">
      {name[0]?.toUpperCase() ?? "U"}
    </span>
  );
}

function InboxRow({
  message,
  onRead,
  onOpen,
}: {
  message: InboxMessage;
  onRead: (message: InboxMessage) => Promise<void>;
  onOpen: (message: InboxMessage) => void;
}) {
  function handleClick() {
    void onRead(message);
    onOpen(message);
  }

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className={`group flex w-full items-start gap-3.5 px-5 py-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/30 sm:px-6 ${
          message.unread ? "bg-brand-50/30 hover:bg-brand-50/60" : "hover:bg-slate-50"
        }`}
      >
        <span className="relative mt-0.5 shrink-0">
          <Avatar name={message.sender_name} avatar={message.sender_avatar} />
          {message.unread && (
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-brand-500 ring-2 ring-white" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span
              className={`truncate text-sm leading-6 ${
                message.unread ? "font-semibold text-slate-900" : "font-medium text-slate-700"
              }`}
            >
              <UserName name={message.sender_name} rainbow={message.sender_rainbow} />
            </span>
            <time
              dateTime={message.created_at}
              className="shrink-0 pt-0.5 text-[11px] text-slate-400"
            >
              {timeAgo(message.created_at)}
            </time>
          </span>

          <span
            data-no-translate
            className={`mt-0.5 line-clamp-2 block break-words text-xs leading-5 ${
              message.unread ? "text-slate-600" : "text-slate-500"
            }`}
          >
            {richTextToPlainText(message.content)}
          </span>
        </span>
      </button>
    </li>
  );
}

function OutboxRow({ message }: { message: OutboxMessage }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="group flex w-full items-start gap-3.5 px-5 py-4 text-left outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/30 sm:px-6"
      >
        <span className="mt-0.5 shrink-0">
          <Avatar name={message.recipient_name} avatar={message.recipient_avatar} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="truncate text-sm leading-6 font-medium text-slate-700">
              <span className="text-slate-400">收件人：</span>
              <UserName name={message.recipient_name} rainbow={message.recipient_rainbow} />
            </span>
            <time
              dateTime={message.created_at}
              className="shrink-0 pt-0.5 text-[11px] text-slate-400"
            >
              {timeAgo(message.created_at)}
            </time>
          </span>

          <span
            data-no-translate
            className={`mt-0.5 block break-words text-xs leading-5 ${
              expanded ? "whitespace-pre-wrap" : "line-clamp-2"
            } text-slate-500`}
          >
            {richTextToPlainText(message.content)}
          </span>
        </span>
      </button>
    </li>
  );
}

/** 收件详情弹窗 —— 查看全文并可直接回复 */
function InboxDetailDialog({
  message,
  onClose,
  onReplied,
}: {
  message: InboxMessage;
  onClose: () => void;
  onReplied: () => void;
}) {
  const [reply, setReply] = useState("");
  const [replyKey, setReplyKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<null | { ok: boolean; msg: string }>(null);

  const trimmedReply = reply.trim();
  const hasReply = trimmedReply.length > 0 && !/^<p>\s*<\/p>$/i.test(trimmedReply);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleReply() {
    if (!hasReply || sending) return;

    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: message.sender_email, content: trimmedReply }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!res.ok || !data?.ok) {
        setFeedback({ ok: false, msg: data?.message ?? "回复失败，请稍后重试" });
        return;
      }

      setReply("");
      setReplyKey((key) => key + 1);
      setFeedback({ ok: true, msg: "回复已发送" });
      onReplied();
    } catch {
      setFeedback({ ok: false, msg: "网络错误，请稍后重试" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="收件详情"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start gap-3.5 border-b border-slate-100 px-5 py-4 sm:px-6">
          <Avatar name={message.sender_name} avatar={message.sender_avatar} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              <UserName name={message.sender_name} rainbow={message.sender_rainbow} />
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {new Date(message.created_at).toLocaleString("zh-CN")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {isRichText(message.content) ? (
            <div
              data-no-translate
              className="prose prose-sm prose-slate max-w-none break-words text-slate-700"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(message.content) }}
            />
          ) : (
            <p
              data-no-translate
              className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700"
            >
              {message.content}
            </p>
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
          <Editor
            key={replyKey}
            content={reply}
            onChange={setReply}
            compact
            collapsibleToolbar
            placeholder={`回复 ${message.sender_name}…`}
          />

          {feedback && (
            <p
              role="status"
              className={`mt-2 text-xs ${feedback.ok ? "text-emerald-600" : "text-red-500"}`}
            >
              {feedback.msg}
            </p>
          )}

          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleReply}
              disabled={sending || !hasReply}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="size-4" strokeWidth={1.8} />
              {sending ? "发送中…" : "回复"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
