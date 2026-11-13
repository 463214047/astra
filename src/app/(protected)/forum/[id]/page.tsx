import Link from "next/link";
import { notFound } from "next/navigation";
import { query, ensureSchema } from "@/lib/db";
import { auth } from "@/auth";
import CommentsSection from "@/components/comments-section";
import FavoriteButton from "@/components/favorite-button";
import { isRainbowName } from "@/lib/rainbow";
import { UserName } from "@/components/rainbow-name";
import NextImage from "next/image";

type TopicTag = "求助" | "邀请" | "分享" | "讨论" | "公告";

type ForumDetail = {
  id: string;
  title: string;
  content: string;
  category: TopicTag;
  anonymous: boolean;
  author_email: string;
  author_name: string | null;
  author_uid: number | null;
  author_avatar: string | null;
  comment_count: number;
  favorite_count: number;
  created_at: string;
  updated_at: string;
  author_role: string | null;
  author_rainbow_enabled: boolean | null;
  author_rainbow_until: Date | string | null;
};

let schemaEnsured = false;

async function fetchForumPost(id: string): Promise<ForumDetail | null> {
  if (!schemaEnsured) {
    await ensureSchema();
    schemaEnsured = true;
  }
  const rows = await query<
    ForumDetail & { author_uid_raw: string | null; author_avatar_raw: string | null }
  >(
    `SELECT p.id, p.title, p.content, p.category,
            p.anonymous, p.author_email, p.author_name,
            p.comment_count, p.favorite_count, p.created_at, p.updated_at,
            u.uid AS author_uid_raw, u.avatar_url AS author_avatar_raw,
            u.role AS author_role,
            u.rainbow_enabled AS author_rainbow_enabled,
            u.rainbow_until AS author_rainbow_until
     FROM public.posts p
     LEFT JOIN public.account_users u ON u.email = p.author_email
     WHERE p.id = $1 AND p.post_type = 'forum' AND p.status = 'published'`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    ...r,
    author_uid: r.author_uid_raw ? Number(r.author_uid_raw) : null,
    author_avatar: r.author_avatar_raw,
    anonymous: Boolean(r.anonymous),
  };
}

/** 内联样式白名单 — 仅保留 color / font-size */
function sanitizeInlineStyle(value: string): string | null {
  const kept: string[] = [];
  for (const part of value.split(";")) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (prop === "color" && /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(val)) kept.push(`color:${val}`);
    else if (prop === "font-size" && /^\d{1,2}(?:\.\d+)?px$/.test(val))
      kept.push(`font-size:${val}`);
  }
  return kept.length ? kept.join(";") : null;
}

function sanitizeHtml(html: string): string {
  if (!html) return "";
  const stripped = html
    .replace(
      /<\s*(script|iframe|object|embed|style|form|input|textarea|button|link|meta)[^>]*>/gi,
      "",
    )
    .replace(
      /<\s*\/\s*(script|iframe|object|embed|style|form|input|textarea|button|link|meta)[^>]*>/gi,
      "",
    );
  const ALLOWED_TAGS = new Set([
    "p",
    "br",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "s",
    "del",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "img",
    "a",
    "hr",
    "span",
    "div",
    "details",
    "summary",
  ]);
  const ALLOWED_ATTRS: Record<string, Set<string>> = {
    img: new Set(["src", "alt", "class"]),
    a: new Set(["href", "target", "rel", "class"]),
    code: new Set(["class"]),
    pre: new Set(["class"]),
    blockquote: new Set(["class"]),
    span: new Set(["style"]),
    div: new Set(["class", "data-type"]),
    details: new Set(["class", "open"]),
    summary: new Set(["class"]),
  };
  return stripped.replace(
    /<(\/?)([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?\s*>/g,
    (_m, slash, tag, attrs) => {
      const tagLower = tag.toLowerCase();
      if (!ALLOWED_TAGS.has(tagLower)) return "";
      if (!slash) {
        let cleanAttrs = "";
        const allowedForTag = ALLOWED_ATTRS[tagLower] ?? new Set();
        if (attrs) {
          const attrMatches = attrs.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g);
          for (const a of attrMatches) {
            const name = a[1].toLowerCase();
            const value = a[2] ?? a[3] ?? a[4] ?? "";
            if (allowedForTag.has(name)) {
              if (name === "style") {
                const safeStyle = sanitizeInlineStyle(value);
                if (safeStyle) cleanAttrs += ` style="${safeStyle}"`;
                continue;
              }
              if (tagLower === "img" && name === "src") {
                // 站内上传的图片是 /uploads/... 相对路径，需一并放行
                if (!/^(https?:\/\/|\/(?!\/))[^\s"<>]+$/i.test(value)) continue;
              } else if (tagLower === "a" && name === "href") {
                if (!/^https?:\/\/[^\s"<>]+$/i.test(value)) continue;
              }
              cleanAttrs += ` ${name}="${value.replace(/"/g, "&quot;")}"`;
            }
          }
        }
        return `<${tagLower}${cleanAttrs}>`;
      }
      return `</${tagLower}>`;
    },
  );
}

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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await fetchForumPost(id);
  if (!post) return { title: "帖子不存在" };
  return { title: `${post.title} · 论坛` };
}

export default async function ForumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await fetchForumPost(id);
  if (!post) notFound();

  const session = await auth();
  const currentEmail = session?.user?.email;
  const isAuthor = currentEmail === post.author_email;

  const displayName = post.anonymous
    ? "匿名用户"
    : (post.author_name ?? post.author_email.split("@")[0]);
  const rainbow =
    !post.anonymous &&
    isRainbowName({
      role: post.author_role,
      rainbow_enabled: post.author_rainbow_enabled,
      rainbow_until: post.author_rainbow_until,
    });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      {/* 主卡 */}
      <article className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] [[data-background=tohru]_&]:bg-transparent">
        <div className="p-5 sm:p-7">
          <header>
            <h1
              data-no-translate
              className="text-xl font-bold leading-tight text-slate-900 sm:text-2xl"
            >
              {post.title}
            </h1>

            {/* 作者 / 时间 / 统计 */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
              {post.anonymous ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-grid size-7 place-items-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">
                    匿
                  </span>
                  <span className="text-[13px] font-medium text-slate-700">{displayName}</span>
                </span>
              ) : post.author_uid ? (
                <Link
                  href={`/users/${post.author_uid}`}
                  className="group inline-flex items-center gap-2 rounded-lg px-1 py-0.5 -mx-1 transition hover:bg-slate-100"
                >
                  {post.author_avatar ? (
                    <NextImage
                      src={post.author_avatar}
                      alt={displayName}
                      width={28}
                      height={28}
                      unoptimized
                      className="size-7 rounded-full ring-1 ring-slate-200"
                    />
                  ) : (
                    <span className="inline-grid size-7 place-items-center rounded-full text-[11px] font-semibold bg-slate-900 text-white">
                      {displayName[0]}
                    </span>
                  )}
                  <span className="text-[13px] font-medium text-slate-700 group-hover:text-brand-800">
                    <UserName name={displayName} rainbow={rainbow} />
                  </span>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-2">
                  {post.author_avatar ? (
                    <NextImage
                      src={post.author_avatar}
                      alt={displayName}
                      width={28}
                      height={28}
                      unoptimized
                      className="size-7 rounded-full ring-1 ring-slate-200"
                    />
                  ) : (
                    <span className="inline-grid size-7 place-items-center rounded-full text-[11px] font-semibold bg-slate-900 text-white">
                      {displayName[0]}
                    </span>
                  )}
                  <span className="text-[13px] font-medium text-slate-700">
                    <UserName name={displayName} rainbow={rainbow} />
                  </span>
                </span>
              )}

              <span className="text-slate-300">·</span>
              <span>{formatTime(post.updated_at)}</span>

              <span className="ml-auto flex items-center gap-1.5">
                <FavoriteButton postId={post.id} />
                {isAuthor && (
                  <Link
                    href={`/forum/new?edit=${post.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    编辑
                  </Link>
                )}
              </span>
            </div>
          </header>
        </div>
      </article>

      {/* 正文 */}
      {post.content && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] p-5 sm:p-7 [[data-background=tohru]_&]:bg-transparent">
          <div
            className="prose prose-slate max-w-none break-words text-[15px] leading-[2] text-slate-800 prose-p:my-3 prose-headings:mt-6 prose-headings:mb-2 prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-ul:my-3 prose-ol:my-3 prose-li:my-0.5 prose-blockquote:my-4 prose-img:my-4 prose-img:rounded-xl prose-a:text-brand-700 prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-pre:bg-slate-900 prose-pre:text-slate-100"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
          />
        </div>
      )}

      {/* 评论区 */}
      <CommentsSection postId={post.id} />
    </div>
  );
}
