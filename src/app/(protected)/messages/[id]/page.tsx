"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Lock,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { UserName } from "@/components/rainbow-name";

type Msg = {
  id: string;
  sender_email: string;
  is_me: boolean;
  content: string;
  created_at: string;
  read_by_me: boolean;
  recipient_has_seen: boolean;
};

type ConvInfo = {
  id: string;
  other_email: string;
  other_name: string;
  other_avatar: string | null;
  other_rainbow: boolean;
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  if (sameDay) return `${hours}:${minutes}`;

  const diff = (now.getTime() - date.getTime()) / 86400000;
  if (diff < 2) return `昨天 ${hours}:${minutes}`;

  return `${date.getMonth() + 1}/${date.getDate()} ${hours}:${minutes}`;
}

type ConversationData = {
  conversation: ConvInfo;
  messages: Msg[];
};

async function requestConversation(id: string): Promise<ConversationData> {
  const res = await fetch(`/api/messages/${id}`, { cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    conversation?: ConvInfo;
    messages?: Msg[];
  };

  if (!res.ok || !data.ok || !data.conversation || !data.messages) {
    throw new Error(data.message ?? "加载失败");
  }

  return {
    conversation: data.conversation,
    messages: data.messages,
  };
}

function markConversationRead(id: string) {
  return fetch(`/api/messages/${id}`, { method: "PATCH" }).catch(() => undefined);
}

function groupByDay(messages: Msg[]): { dateLabel: string; items: Msg[] }[] {
  const groups: { dateLabel: string; items: Msg[] }[] = [];

  for (const message of messages) {
    const date = new Date(message.created_at);
    const now = new Date();
    const diffDays = Math.floor(
      (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
        new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
        86400000,
    );

    let label: string;
    if (diffDays === 0) label = "今天";
    else if (diffDays === 1) label = "昨天";
    else if (diffDays < 7) label = `${diffDays} 天前`;
    else {
      label = `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
    }

    const last = groups[groups.length - 1];
    if (last && last.dateLabel === label) last.items.push(message);
    else groups.push({ dateLabel: label, items: [message] });
  }

  return groups;
}

export default function ConversationPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const scrollRef = useRef<HTMLDivElement>(null);

  const [conv, setConv] = useState<ConvInfo | null>(null);
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchConv = useCallback(async () => {
    if (!id) return;
    setError(null);

    try {
      const data = await requestConversation(id);
      setConv(data.conversation);
      setMessages(data.messages);
      void markConversationRead(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let active = true;

    requestConversation(id)
      .then((data) => {
        if (!active) return;
        setConv(data.conversation);
        setMessages(data.messages);
        setError(null);
        void markConversationRead(id);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "加载失败");
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  // 打开后滚动到底部
  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  if (error && !conv) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-4xl flex-col px-4 py-4 sm:px-6 sm:py-6">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
          <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-3 py-3 sm:px-4">
            <Link
              href="/messages"
              aria-label="返回消息列表"
              className="grid size-9 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <ArrowLeft className="size-4" strokeWidth={1.8} />
            </Link>
            <h1 className="truncate text-sm font-semibold text-slate-900">消息记录</h1>
          </header>

          <div
            role="alert"
            className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center"
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100">
              <AlertCircle className="size-6" strokeWidth={1.6} />
            </span>
            <p className="mt-4 text-sm font-semibold text-slate-700">加载失败</p>
            <p className="mt-1 max-w-sm break-words text-xs leading-5 text-slate-400">{error}</p>
            <button
              type="button"
              onClick={fetchConv}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <RefreshCw className="size-3.5" strokeWidth={1.8} />
              重试
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-4xl flex-col px-4 py-4 sm:px-6 sm:py-6">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-3 py-3 sm:px-4">
          <Link
            href="/messages"
            aria-label="返回消息列表"
            className="grid size-9 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="size-4" strokeWidth={1.8} />
          </Link>

          {conv?.other_avatar ? (
            <Image
              src={conv.other_avatar}
              alt={conv.other_name}
              width={36}
              height={36}
              unoptimized
              className="size-9 shrink-0 rounded-full object-cover ring-2 ring-white"
            />
          ) : (
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-100 via-brand-50 to-brand-100 text-sm font-semibold text-slate-600">
              {conv?.other_name?.[0]?.toUpperCase() ?? "U"}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-slate-900">
              {conv ? <UserName name={conv.other_name} rainbow={conv.other_rainbow} /> : "加载中…"}
            </h1>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
              <Lock className="size-3" strokeWidth={1.8} />
              只读会话
            </p>
          </div>
        </header>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-4 py-4 sm:px-5 sm:py-5"
        >
          {messages === null && <MessageSkeleton />}

          {messages && messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-white text-slate-400 ring-1 ring-slate-200/70">
                <MessageCircle className="size-6" strokeWidth={1.6} />
              </span>
              <p className="mt-4 text-sm font-medium text-slate-600">暂无消息记录</p>
            </div>
          )}

          {messages && messages.length > 0 && (
            <div className="space-y-6">
              {groupByDay(messages).map((group) => (
                <div key={group.dateLabel} className="space-y-2">
                  <div className="flex justify-center py-1">
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-400 shadow-sm ring-1 ring-slate-200/70">
                      {group.dateLabel}
                    </span>
                  </div>

                  {group.items.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.is_me ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`flex max-w-[82%] flex-col gap-1 sm:max-w-[72%] ${
                          message.is_me ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-6 shadow-sm ${
                            message.is_me
                              ? "rounded-br-md bg-brand-600 text-white shadow-brand-600/10"
                              : "rounded-bl-md border border-slate-200/80 bg-white text-slate-800 shadow-slate-900/[0.03]"
                          }`}
                        >
                          {message.content}
                        </div>

                        <div
                          className={`flex items-center gap-1 text-[10px] text-slate-400 ${
                            message.is_me ? "justify-end" : "justify-start"
                          }`}
                        >
                          <span>{formatTime(message.created_at)}</span>
                          {message.is_me &&
                            (message.recipient_has_seen ? (
                              <>
                                <CheckCheck
                                  className="size-3 text-brand-600"
                                  strokeWidth={2}
                                  aria-hidden="true"
                                />
                                <span className="text-brand-600">已读</span>
                              </>
                            ) : (
                              <>
                                <Check className="size-3" strokeWidth={2} aria-hidden="true" />
                                <span>已发送</span>
                              </>
                            ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className="flex justify-center py-1">
        <div className="h-6 w-16 animate-pulse rounded-full bg-slate-200/70" />
      </div>
      <div className="flex justify-start">
        <div className="h-16 w-2/3 animate-pulse rounded-2xl rounded-bl-md bg-slate-200/60" />
      </div>
      <div className="flex justify-end">
        <div className="h-10 w-1/2 animate-pulse rounded-2xl rounded-br-md bg-brand-100" />
      </div>
      <div className="flex justify-start">
        <div className="h-10 w-3/5 animate-pulse rounded-2xl rounded-bl-md bg-slate-200/60" />
      </div>
    </div>
  );
}
