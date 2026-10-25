"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  ChevronRight,
  MessageCircle,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { UserName } from "@/components/rainbow-name";

type TabKey = "notifications" | "conversations";

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

type Conversation = {
  id: string;
  other_email: string;
  other_name: string;
  other_avatar: string | null;
  other_rainbow: boolean;
  last_message: string;
  last_message_time: string;
  last_sender_email: string | null;
  unread: number;
};

type FeedItem =
  | { kind: "notification"; time: string; notification: Notification }
  | { kind: "conversation"; time: string; conversation: Conversation };

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "notifications", label: "通知", icon: Bell },
  { key: "conversations", label: "私信", icon: MessageCircle },
];

const EMPTY_COPY: Record<TabKey, { title: string; description: string; icon: LucideIcon }> = {
  notifications: {
    title: "暂无通知",
    description: "新的系统通知和回复会显示在这里",
    icon: Bell,
  },
  conversations: {
    title: "暂无私信",
    description: "与站内用户的私信会显示在这里",
    icon: MessageCircle,
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

type InboxData = {
  notifications: Notification[];
  notificationUnread: number;
  conversations: Conversation[];
  conversationUnread: number;
};

/** 拉取收件箱数据，不直接修改组件状态 */
async function requestInbox(): Promise<InboxData> {
  const [notifRes, convRes] = await Promise.all([
    fetch("/api/notifications", { cache: "no-store" }),
    fetch("/api/messages", { cache: "no-store" }),
  ]);

  const nd = (await notifRes.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    items?: Notification[];
    unread?: { total?: number };
  };
  const cd = (await convRes.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    conversations?: Conversation[];
  };

  if (!notifRes.ok || !nd.ok || !convRes.ok || !cd.ok) {
    throw new Error(nd.message ?? cd.message ?? "消息加载失败");
  }

  const conversations = cd.conversations ?? [];

  return {
    notifications: nd.items ?? [],
    notificationUnread: Number(nd.unread?.total ?? 0),
    conversations,
    conversationUnread: conversations.reduce((sum, conversation) => sum + conversation.unread, 0),
  };
}

export default function MessagesPage() {
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>("notifications");
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [convUnread, setConvUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const applyInbox = useCallback((data: InboxData) => {
    setNotifs(data.notifications);
    setNotifUnread(data.notificationUnread);
    setConvs(data.conversations);
    setConvUnread(data.conversationUnread);
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const data = await requestInbox();
      applyInbox(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "消息加载失败");
    } finally {
      setLoading(false);
    }
  }, [applyInbox]);

  useEffect(() => {
    let active = true;

    requestInbox()
      .then((data) => {
        if (active) applyInbox(data);
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
  }, [applyInbox]);

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
      const notificationsRes = await fetch("/api/notifications/read-all", {
        method: "PATCH",
      });
      if (!notificationsRes.ok) throw new Error("标记通知失败");

      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setNotifUnread(0);

      const unreadConversations = convs.filter((c) => c.unread > 0);
      await Promise.all(
        unreadConversations.map((c) =>
          fetch(`/api/messages/${c.id}`, { method: "PATCH" }).catch(() => undefined),
        ),
      );
      setConvs((prev) => prev.map((c) => ({ ...c, unread: 0 })));
      setConvUnread(0);
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
      router.refresh();
    } catch {
      setActionError("标记已读失败，请稍后重试");
    }
  }

  const activeTab = TABS.find((item) => item.key === tab) ?? TABS[0];
  const ActiveIcon = activeTab.icon;
  const totalUnread = notifUnread + convUnread;

  const notificationItems: FeedItem[] =
    tab === "conversations"
      ? []
      : notifs.map((notification) => ({
          kind: "notification",
          time: notification.created_at,
          notification,
        }));

  const conversationItems: FeedItem[] =
    tab === "notifications"
      ? []
      : convs.map((conversation) => ({
          kind: "conversation",
          time: conversation.last_message_time,
          conversation,
        }));

  const feedItems = [...notificationItems, ...conversationItems].sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
  );

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
          <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm shadow-slate-900/[0.03] min-[900px]:flex-col">
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
          className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <ActiveIcon className="size-4 shrink-0 text-slate-400" strokeWidth={1.8} />
              <h2 className="text-sm font-semibold text-slate-900">{activeTab.label}</h2>
            </div>
          </div>

          {loading ? (
            <FeedSkeleton />
          ) : error ? (
            <ErrorState message={error} onRetry={handleRetry} />
          ) : feedItems.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {feedItems.map((item) =>
                item.kind === "notification" ? (
                  <NotificationRow
                    key={`n-${item.notification.id}`}
                    notification={item.notification}
                    onMarkRead={markNotifRead}
                    onNavigate={(href) => router.push(href)}
                  />
                ) : (
                  <ConversationRow
                    key={`c-${item.conversation.id}`}
                    conversation={item.conversation}
                  />
                ),
              )}
            </ul>
          )}
        </section>
      </div>
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

        {href && (
          <ChevronRight
            className="mt-3 size-4 shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500"
            strokeWidth={1.8}
          />
        )}
      </button>
    </li>
  );
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const unread = conversation.unread > 0;
  const sentByMe =
    conversation.last_sender_email && conversation.last_sender_email !== conversation.other_email;

  return (
    <li>
      <Link
        href={`/messages/${conversation.id}`}
        className={`group flex items-center gap-3.5 px-5 py-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/30 sm:px-6 ${
          unread ? "bg-brand-50/30 hover:bg-brand-50/60" : "hover:bg-slate-50"
        }`}
      >
        <span className="relative shrink-0">
          {conversation.other_avatar ? (
            <Image
              src={conversation.other_avatar}
              alt={conversation.other_name}
              width={44}
              height={44}
              unoptimized
              className="size-11 rounded-full object-cover ring-2 ring-white"
            />
          ) : (
            <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-brand-100 via-brand-50 to-brand-100 text-sm font-semibold text-slate-600 ring-2 ring-white">
              {conversation.other_name[0]?.toUpperCase() ?? "U"}
            </span>
          )}
          {unread && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-brand-500 ring-2 ring-white"
            />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span
              className={`truncate text-sm leading-6 ${
                unread ? "font-semibold text-slate-900" : "font-medium text-slate-700"
              }`}
            >
              <UserName name={conversation.other_name} rainbow={conversation.other_rainbow} />
            </span>
            <time
              dateTime={conversation.last_message_time}
              className="shrink-0 pt-0.5 text-[11px] text-slate-400"
            >
              {timeAgo(conversation.last_message_time)}
            </time>
          </span>

          <span
            className={`mt-0.5 block truncate text-xs leading-5 ${
              unread ? "font-medium text-slate-600" : "text-slate-500"
            }`}
          >
            {sentByMe && <span className="text-slate-400">你：</span>}
            {conversation.last_message || "（暂无消息）"}
          </span>
        </span>

        <ChevronRight
          className="size-4 shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500"
          strokeWidth={1.8}
        />
      </Link>
    </li>
  );
}
