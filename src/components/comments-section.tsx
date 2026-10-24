"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import Editor from "@/components/editor";
import { UserName } from "@/components/rainbow-name";

type Comment = {
  id: string;
  post_id: string;
  author_email: string;
  author_name: string | null;
  author_avatar: string | null;
  anonymous: boolean;
  parent_id: string | null;
  reply_to_email: string | null;
  content: string;
  created_at: string;
  rainbow: boolean;
};

type Props = {
  postId: string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return d.toLocaleDateString("zh-CN");
}

/** 取 HTML 的纯文本（摘要 / 判空用） */
function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** 评论是否为空：无文字且无图片才算空 */
function isBlank(html: string): boolean {
  return !/<img\b/i.test(html) && plainText(html).length === 0;
}

/* ---------- HTML 清洗（评论场景） ---------- */

const SAFE_URL_RE = /^https?:\/\//i;

/** 从标签属性区里取指定属性值（双引号 / 单引号 / 裸值） */
function extractAttr(rest: string, name: string): string | null {
  const m = rest.match(
    new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"),
  );
  if (!m) return null;
  return (m[2] ?? m[3] ?? m[4] ?? "").trim();
}

/** 只放行 http/https，且不含引号 / 尖括号 / 空白的 URL */
function safeUrl(raw: string | null): string | null {
  if (!raw || !SAFE_URL_RE.test(raw)) return null;
  if (/["'<>\s]/.test(raw)) return null;
  return raw;
}

/**
 * 简单 HTML 清洗：白名单标签；
 * a / img 额外保留校验过的 http(s) href / src，其余属性（onerror、style 等）一律丢弃
 */
function sanitizeCommentHtml(html: string): string {
  if (!html) return "";
  const allowedTags = new Set([
    "p", "br", "strong", "em", "s", "del", "b", "i", "u", "a", "img",
    "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "pre", "code", "hr",
  ]);
  return html.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g,
    (match, rawName: string, rest: string) => {
      const tag = rawName.toLowerCase();
      if (!allowedTags.has(tag)) return "";
      if (match.startsWith("</")) return `</${tag}>`;
      if (tag === "a") {
        const href = safeUrl(extractAttr(rest, "href"));
        return href
          ? `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">`
          : "<a>";
      }
      if (tag === "img") {
        const src = safeUrl(extractAttr(rest, "src"));
        return src
          ? `<img src="${src}" alt="" loading="lazy" referrerpolicy="no-referrer">`
          : "";
      }
      return `<${tag}>`;
    },
  );
}

/** 引用摘要：纯文本优先，纯图片评论显示 [图片] */
function quoteExcerpt(content: string): string {
  const text = plainText(content);
  if (text) return text.slice(0, 100);
  return /<img\b/i.test(content) ? "[图片]" : "";
}

/** 显示名（anonymous 分支为兼容历史数据保留） */
function displayNameOf(c: Comment): string {
  if (c.anonymous) return "匿名用户";
  return c.author_name ?? c.author_email.split("@")[0];
}

export default function CommentsSection({ postId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [contentHtml, setContentHtml] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const composerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`);
      const data = await res.json();
      if (data.ok) setComments(data.comments);
      else setError(data.message ?? "加载失败");
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (submitting || isBlank(contentHtml)) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: contentHtml,
          parent_id: replyTo?.id ?? null,
          reply_to_email: replyTo?.author_email ?? null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setContentHtml("");
        setEditorKey((k) => k + 1); // 重挂编辑器 → 清空
        setReplyTo(null);
        await load();
      } else {
        alert(data.message ?? "评论失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setSubmitting(false);
    }
  };

  /** 点击「回复」：滚回输入框并聚焦（发送后以引用形式呈现） */
  const handleReply = useCallback((c: Comment) => {
    setReplyTo(c);
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    composerRef.current
      ?.querySelector<HTMLElement>('[contenteditable="true"]')
      ?.focus({ preventScroll: true });
  }, []);

  // 平铺时间线：回复不再嵌套，改为引用上级
  const byId = new Map(comments.map((c) => [c.id, c]));
  const totalCount = comments.length;
  const hasContent = !isBlank(contentHtml);

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
      {/* 标题栏 */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-slate-900 text-slate-50">
            <MessageSquare size={13} strokeWidth={1.5} />
          </span>
          <span className="text-sm font-semibold text-slate-800">评论</span>
          {totalCount > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              {totalCount}
            </span>
          )}
        </div>
      </div>

      {/* 发表评论 */}
      <div ref={composerRef} className="border-b border-slate-100 p-4 sm:p-5">
        {replyTo && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <span className="shrink-0">
              引用{" "}
              <span className="font-medium text-slate-700">
                <UserName name={displayNameOf(replyTo)} rainbow={replyTo.rainbow} />
              </span>
              ：
            </span>
            <span className="min-w-0 flex-1 truncate text-slate-400">
              {quoteExcerpt(replyTo.content)}
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="取消回复"
              className="shrink-0 rounded-md px-1 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* 富文本编辑器（与发布页「介绍」同款，紧凑尺寸） */}
        <div className="rounded-xl border border-slate-200 overflow-hidden focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-900/5 transition">
          <Editor
            key={editorKey}
            content=""
            onChange={setContentHtml}
            placeholder="说点什么…"
            compact
          />
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={submit}
            disabled={!hasContent || submitting}
            className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:active:scale-100"
          >
            {submitting ? "发送中…" : "发送"}
          </button>
        </div>
      </div>

      {/* 列表（时间倒序平铺，最新在前） */}
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">加载中…</p>
      ) : error ? (
        <p className="py-10 text-center text-sm text-rose-500">{error}</p>
      ) : totalCount === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">还没有评论，来抢沙发吧 ✨</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              parent={c.parent_id ? (byId.get(c.parent_id) ?? null) : null}
              onReply={handleReply}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- 单条评论（平铺；回复以引用块呈现） ---------- */
function CommentItem({
  comment,
  parent,
  onReply,
}: {
  comment: Comment;
  parent: Comment | null;
  onReply: (c: Comment) => void;
}) {
  const displayName = displayNameOf(comment);
  const quote = parent ? quoteExcerpt(parent.content) : "";

  // 判断 content 是 HTML 还是纯文本（TipTap 输出会有 <p> 标签）
  const isHtml = /<[a-z][^>]*>/i.test(comment.content);
  const safeHtml = isHtml ? sanitizeCommentHtml(comment.content) : "";

  return (
    <div className="px-5 py-4">
      <div className="flex gap-3">
        {/* 头像 */}
        {comment.author_avatar && !comment.anonymous ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comment.author_avatar}
            alt={displayName}
            className="size-8 shrink-0 rounded-full border border-slate-200 object-cover"
          />
        ) : (
          <div
            className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${
              comment.anonymous
                ? "border border-slate-200 bg-slate-100 text-slate-500"
                : "bg-slate-900 text-white"
            }`}
          >
            {displayName[0]}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
            <span className="font-medium text-slate-800">
              <UserName name={displayName} rainbow={comment.rainbow} />
            </span>
            {comment.anonymous && (
              <span className="rounded bg-slate-100 px-1.5 py-px text-[10px] text-slate-400">匿名</span>
            )}
            <span className="text-slate-300">·</span>
            <time className="text-slate-400">{formatTime(comment.created_at)}</time>
            <button
              type="button"
              onClick={() => onReply(comment)}
              className="ml-auto rounded-md px-1.5 py-px text-[11px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              回复
            </button>
          </div>

          {/* 引用块（回复不嵌套，改为引用上级） */}
          {parent && (
            <div className="mt-1.5 line-clamp-2 rounded-md border-l-2 border-slate-300 bg-slate-50 py-1 pl-2.5 pr-2 text-xs leading-5 text-slate-500">
              <span className="font-medium text-slate-600">
                @<UserName name={displayNameOf(parent)} rainbow={parent.rainbow} />
              </span>
              {quote ? <span>：{quote}</span> : null}
            </div>
          )}

          {/* 内容 */}
          {isHtml ? (
            <div
              className="prose prose-slate mt-1.5 max-w-none break-words text-sm leading-relaxed text-slate-800 prose-p:m-0 prose-p:leading-relaxed prose-blockquote:border-l-2 prose-blockquote:border-slate-300 prose-blockquote:pl-2 prose-blockquote:text-slate-500 prose-img:my-2 prose-img:rounded-lg prose-img:border prose-img:border-slate-200"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          ) : (
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
              {comment.content}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
