import Link from "next/link";
import MediaGallery from "@/components/media-gallery";
import DownloadButton from "@/components/download-button";
import { notFound, redirect } from "next/navigation";
import { query, ensureSchema } from "@/lib/db";
import { auth } from "@/auth";
import { isRainbowName } from "@/lib/rainbow";
import { UserName } from "@/components/rainbow-name";
import { headers } from "next/headers";
import { ensureUserPasskey } from "@/lib/passkey";
import CommentsSection from "@/components/comments-section";
import ReportButton from "@/components/report-button";
import FavoriteButton from "@/components/favorite-button";
import { parseMediaInfo, findValue } from "@/lib/mediainfo";
import { extractTmdbRef, fetchTmdbInfo } from "@/lib/tmdb";
import TmdbIntroCard from "@/components/tmdb-intro-card";
import Popover from "@/components/popover";
import PostTag from "@/components/post-tag";

type DetailPost = {
  id: string;
  post_type: string;
  category: string;
  title: string;
  subtitle: string | null;
  content: string;
  mediainfo: string | null;
  external_link: string | null;
  tags: string[] | null;
  cover_url: string | null;
  screenshot_urls: string[] | null;
  torrent_name: string | null;
  torrent_size: number | null;
  hot: boolean;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  author_email: string;
  author_uid: number | null;
  author_name: string | null;
  author_avatar: string | null;
  author_role: string | null;
  author_rainbow_enabled: boolean | null;
  author_rainbow_until: Date | string | null;
  anonymous: boolean;
};

let schemaEnsured = false;

async function fetchPost(id: string): Promise<DetailPost | null> {
  try {
    if (!schemaEnsured) {
      await ensureSchema();
      schemaEnsured = true;
    }

    const rows = await query<DetailPost>(
      `SELECT id, post_type,
              category, title, subtitle, content, mediainfo, external_link,
              anonymous, author_email, author_name,
              tags, cover_url, screenshot_urls,
              torrent_name, torrent_size,
              hot, view_count, like_count, comment_count,
              created_at, updated_at
       FROM public.posts
       WHERE id = $1 AND status = 'published'`,
      [id],
    );

    const row = rows[0];
    if (!row) return null;

    // 查作者 uid + 头像（单独查询，避免 JOIN 兼容问题）
    try {
      const userRows = await query<{
        uid: number;
        avatar_url: string | null;
        role: string;
        rainbow_enabled: boolean;
        rainbow_until: Date | string | null;
      }>(
        `SELECT uid, avatar_url, role, rainbow_enabled, rainbow_until
           FROM public.account_users WHERE email = $1`,
        [row.author_email],
      );
      row.author_uid = userRows[0]?.uid ?? null;
      row.author_avatar = userRows[0]?.avatar_url ?? null;
      row.author_role = userRows[0]?.role ?? null;
      row.author_rainbow_enabled = userRows[0]?.rainbow_enabled ?? null;
      row.author_rainbow_until = userRows[0]?.rainbow_until ?? null;
    } catch {
      row.author_uid = null;
      row.author_avatar = null;
      row.author_role = null;
      row.author_rainbow_enabled = null;
      row.author_rainbow_until = null;
    }

    return {
      ...row,
      anonymous: Boolean(row.anonymous),
    };
  } catch (err) {
    console.error("[帖子详情] fetchPost 失败:", err);
    return null;
  }
}

/**
 * 简单 HTML 白名单清洗 — 仅保留 TipTap 会生成的安全标签/属性
 * 防止用户绕过编辑器提交危险 HTML（如 <script>）
 */
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
]);
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  img: new Set(["src", "alt", "class"]),
  a: new Set(["href", "target", "rel", "class"]),
  code: new Set(["class"]),
  pre: new Set(["class"]),
  blockquote: new Set(["class"]),
  strong: new Set(["class"]),
  em: new Set(["class"]),
};

function sanitizeHtml(html: string): string {
  if (!html) return "";
  // 简单方式：用正则把所有不在白名单里的标签剥掉
  // 先移除危险标签（script, iframe, object, embed, style, form, input 等）
  const stripped = html
    .replace(
      /<\s*(script|iframe|object|embed|style|form|input|textarea|button|link|meta)[^>]*>/gi,
      "",
    )
    .replace(
      /<\s*\/\s*(script|iframe|object|embed|style|form|input|textarea|button|link|meta)[^>]*>/gi,
      "",
    );

  // 用正则逐个处理剩余标签
  return stripped.replace(
    /<(\/?)([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?\s*>/g,
    (_m, slash, tag, attrs) => {
      const tagLower = tag.toLowerCase();
      if (!ALLOWED_TAGS.has(tagLower)) return "";

      // 开始标签 — 过滤属性
      if (!slash) {
        let cleanAttrs = "";
        const allowedForTag = ALLOWED_ATTRS[tagLower] ?? new Set();
        if (attrs) {
          // 解析属性
          const attrMatches = attrs.matchAll(/(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g);
          for (const a of attrMatches) {
            const name = a[1].toLowerCase();
            const value = a[2] ?? a[3] ?? a[4] ?? "";
            if (allowedForTag.has(name)) {
              // URL 检查：img/src 和 a/href 必须是 http(s)
              if ((tagLower === "img" && name === "src") || (tagLower === "a" && name === "href")) {
                if (!/^https?:\/\/[^\s"<>]+$/i.test(value)) continue;
              }
              cleanAttrs += ` ${name}="${value.replace(/"/g, "&quot;")}"`;
            }
          }
        }
        return `<${tagLower}${cleanAttrs}>`;
      }
      // 结束标签
      return `</${tagLower}>`;
    },
  );
}

export async function generateMetadata() {
  return { title: "种子详情" };
}

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await fetchPost(id);
  if (!post) notFound();

  // forum 帖 → redirect 到独立的 /forum/[id] 路由
  if (post.post_type === "forum") redirect(`/forum/${id}`);

  const session = await auth();
  const currentEmail = session.user.email;
  const isAuthor = currentEmail === post.author_email;

  // PT 下载链接：带 passkey（有种子时）
  let torrentHref: string | null = null;
  if (post.torrent_name) {
    const passkey = await ensureUserPasskey(currentEmail);
    // 优先用 env，fallback 到当前请求 host
    let origin = process.env.NEXT_PUBLIC_TRACKER_URL;
    if (!origin) {
      const hdrs = await headers();
      const host = hdrs.get("host") ?? "localhost:3000";
      const proto = hdrs.get("x-forwarded-proto") ?? "http";
      origin = `${proto}://${host}`;
    }
    torrentHref = `${origin}/api/torrent/${post.id}?passkey=${passkey}`;
  }

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

  // 作品介绍（TMDB）— 从外部链接 / 正文 / 副标题里解析 TMDB 链接
  const tmdbRef = extractTmdbRef(post.external_link, post.content, post.subtitle);
  const tmdb = tmdbRef ? await fetchTmdbInfo(tmdbRef) : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      {/* 主卡 */}
      <article className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
        <div className="p-5 sm:p-7">
          {/* 标题 + 分类 + 操作按钮 */}
          <header>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {post.hot && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 ring-1 ring-inset ring-rose-600/10">
                      🔥 HOT
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
                  {post.title}
                </h1>
                {(post.subtitle || (post.tags && post.tags.length > 0)) && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {post.subtitle}
                    {post.tags && post.tags.length > 0 && (
                      <span
                        className={`inline-flex flex-wrap items-center gap-1 align-middle ${post.subtitle ? "ml-2" : ""}`}
                      >
                        {post.tags.map((t, i) => (
                          <PostTag key={i} tag={t} />
                        ))}
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* 操作按钮移至下方作者信息行 */}
            </div>

            {/* 作者 / 时间 / 统计 + 操作按钮 */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
              {post.anonymous ? (
                // 匿名帖子：不可点击
                <span className="inline-flex items-center gap-2">
                  <span className="inline-grid size-6 place-items-center rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">
                    {displayName[0]}
                  </span>
                  <span className="text-[13px] font-medium text-slate-700">{displayName}</span>
                  <span className="rounded bg-slate-100 px-1 text-[10px] text-slate-500">匿名</span>
                </span>
              ) : post.author_uid ? (
                // 公开帖子且有 uid：可点击跳转个人主页
                <Link
                  href={`/users/${post.author_uid}`}
                  className="group inline-flex items-center gap-2 rounded-lg px-1 py-0.5 -mx-1 transition hover:bg-slate-100"
                >
                  {post.author_avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.author_avatar}
                      alt={displayName}
                      className="size-6 rounded-full object-cover ring-1 ring-slate-200 transition group-hover:ring-slate-400"
                      loading="lazy"
                    />
                  ) : (
                    <span className="inline-grid size-6 place-items-center rounded-full text-[11px] font-semibold bg-slate-900 text-white">
                      {displayName[0]}
                    </span>
                  )}
                  <span className="text-[13px] font-medium text-slate-700 group-hover:text-brand-800 group-hover:underline underline-offset-2">
                    <UserName name={displayName} rainbow={rainbow} />
                  </span>
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    className="size-3 opacity-0 transition group-hover:opacity-60"
                  >
                    <path
                      d="M9 5l5 5-5 5M4 10h10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              ) : (
                // 公开帖子但无 uid（异常兜底）：静态文本
                <span className="inline-flex items-center gap-2">
                  {post.author_avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.author_avatar}
                      alt={displayName}
                      className="size-6 rounded-full object-cover ring-1 ring-slate-200"
                      loading="lazy"
                    />
                  ) : (
                    <span className="inline-grid size-6 place-items-center rounded-full text-[11px] font-semibold bg-slate-900 text-white">
                      {displayName[0]}
                    </span>
                  )}
                  <span className="text-[13px] font-medium text-slate-700">
                    <UserName name={displayName} rainbow={rainbow} />
                  </span>
                </span>
              )}
              {/* 操作按钮（统一样式，放在行尾） */}
              <span className="ml-auto flex items-center gap-1.5">
                {torrentHref ? (
                  <DownloadButton
                    torrentName={post.torrent_name || "download.torrent"}
                    href={torrentHref}
                  />
                ) : post.torrent_name ? (
                  // 未登录 — 显示下载按钮但指向登录
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
                    title="登录后下载"
                  >
                    <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
                      <path
                        d="M10 3v10m0 0-3.5-3.5M10 13l3.5-3.5M4 15.5h12"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    登录下载
                  </Link>
                ) : null}
                <FavoriteButton postId={post.id} />
                {isAuthor && (
                  <Link
                    href={`/upload?edit=${post.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-[13px] font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
                      <path
                        d="M13.5 2.5a1.8 1.8 0 0 1 2.6 2.6L6 15.2 2 16l.8-4 10.7-9.5Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                    编辑
                  </Link>
                )}
                <ReportButton postId={post.id} />
              </span>
            </div>
          </header>
        </div>
      </article>
      {/* 正文 */}
      {post.content ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] p-5 sm:p-7">
          <div
            className="prose prose-slate prose-lg max-w-none break-words text-[15px] leading-[2] text-slate-800 prose-p:my-4 prose-p:leading-[2] prose-headings:mt-8 prose-headings:mb-3 prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-ul:my-4 prose-ol:my-4 prose-li:my-1 prose-blockquote:my-5 prose-img:my-6 prose-img:rounded-xl prose-img:border prose-img:border-slate-200 prose-a:text-brand-700 prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-pre:bg-slate-900 prose-pre:text-slate-100 sm:text-base sm:leading-[2.1] sm:prose-p:my-5"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
          />
        </div>
      ) : null}

      {/* 作品介绍（TMDB） */}
      {tmdb && <TmdbIntroCard info={tmdb} />}

      {/* MediaInfo */}
      {post.mediainfo &&
        (() => {
          const mi = parseMediaInfo(post.mediainfo);
          if (!mi) return null;

          const audios = mi.streams.filter((s) => s.type === "Audio");
          const texts = mi.streams.filter((s) => s.type === "Text");
          // 多视频轨取主轨（index 最小）
          const mainV = mi.streams
            .filter((s) => s.type === "Video")
            .sort((a, b) => a.index - b.index)[0];

          // 视频字段
          const w = findValue(mainV?.entries ?? [], "Width");
          const h = findValue(mainV?.entries ?? [], "Height");
          const aspect = findValue(
            mainV?.entries ?? [],
            "Display aspect ratio",
            "Original display aspect ratio",
            "Aspect ratio",
          );
          const resolution = [w, h].filter(Boolean).join(" × ") + (aspect ? ` (${aspect})` : "");
          const duration = findValue(mi.general, "Duration");
          const vidBitrate = findValue(mainV?.entries ?? [], "Bit rate");
          const framerate = findValue(mainV?.entries ?? [], "Frame rate");
          const vidFmt = findValue(mainV?.entries ?? [], "Format");
          const profile = findValue(mainV?.entries ?? [], "Format profile", "Profile");
          const level = findValue(mainV?.entries ?? [], "Format level", "Level");
          const videoProfile = [profile, level].filter(Boolean).join("@");
          const hdr = findValue(mainV?.entries ?? [], "HDR format", "HDR format string");
          const colorPrimaries = findValue(
            mainV?.entries ?? [],
            "Colour primaries",
            "Color primaries",
          );
          const fileSize = findValue(mi.general, "File size", "Size");
          const overallBitrate = findValue(mi.general, "Overall bit rate");

          // 音频轨汇总
          const audioSummaries = audios.map((a) => {
            const fmt = findValue(a.entries, "Format", "Codec");
            const ch = findValue(a.entries, "Channel(s)", "Channel layout");
            const br = findValue(a.entries, "Bit rate");
            const lang = findValue(a.entries, "Language");
            const parts = [fmt, ch, br].filter(Boolean);
            return { text: parts.join(" @ "), lang };
          });

          // 字幕轨
          const subSummaries = texts.map((t) => {
            const title = findValue(t.entries, "Title");
            const lang = findValue(t.entries, "Language");
            const forced = findValue(t.entries, "Forced");
            const desc = title || lang || "字幕";
            return `${desc}${forced === "Yes" ? " (强制)" : ""}`;
          });

          // 结构化字段 — 只展示有值的
          const rows: { label: string; value: string; mono?: boolean }[] = [];
          const completeName = findValue(mi.general, "Complete name");
          if (completeName) rows.push({ label: "完整文件名", value: completeName, mono: true });
          if (duration) rows.push({ label: "时长", value: duration });
          if (resolution) rows.push({ label: "分辨率", value: resolution });
          if (vidBitrate) rows.push({ label: "码率", value: vidBitrate });
          if (framerate) rows.push({ label: "帧率", value: `${framerate} ` });
          if (vidFmt) rows.push({ label: "编码格式", value: vidFmt });
          if (videoProfile) rows.push({ label: "格式配置", value: videoProfile });
          if (hdr) rows.push({ label: "HDR 格式", value: hdr });
          if (colorPrimaries) rows.push({ label: "色彩", value: colorPrimaries });
          if (fileSize) rows.push({ label: "文件大小", value: fileSize });
          if (overallBitrate) rows.push({ label: "总码率", value: overallBitrate });

          return (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] overflow-hidden">
              {/* 标题栏 */}
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-6 items-center justify-center rounded-md bg-slate-900 text-slate-50 text-[10px] font-bold">
                    M
                  </span>
                  <span className="text-sm font-semibold text-slate-800">MediaInfo</span>
                </div>
                <Popover trigger="完整原始输出">
                  <pre className="font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words">
                    {mi.raw}
                  </pre>
                </Popover>
              </div>

              {/* 结构化字段 */}
              <div className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-start gap-4 px-5 py-2.5">
                    <span className="w-24 shrink-0 text-[13px] text-slate-500 leading-6">
                      {r.label}
                    </span>
                    <span
                      className={`min-w-0 flex-1 leading-6 text-slate-800 ${
                        r.mono ? "break-all font-mono text-[13px]" : "text-[14px] font-medium"
                      }`}
                    >
                      {r.value}
                    </span>
                  </div>
                ))}

                {/* 音频轨道 */}
                {audioSummaries.length > 0 && (
                  <div className="flex items-start gap-4 px-5 py-2.5">
                    <span className="w-24 shrink-0 text-[13px] text-slate-500 leading-6 pt-0.5">
                      音频轨道
                    </span>
                    <ul className="flex-1 space-y-1">
                      {audioSummaries.map((a, i) => (
                        <li key={i} className="text-[14px] text-slate-800 leading-6">
                          {a.text}
                          {a.lang && (
                            <span className="ml-2 text-[12px] text-slate-400 uppercase">
                              {a.lang}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 字幕 */}
                {subSummaries.length > 0 && (
                  <div className="flex items-start gap-4 px-5 py-2.5">
                    <span className="w-24 shrink-0 text-[13px] text-slate-500 leading-6 pt-0.5">
                      内置字幕
                    </span>
                    <ul className="flex-1 space-y-1">
                      {subSummaries.map((s, i) => (
                        <li key={i} className="text-[14px] text-slate-800 leading-6">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {/* 媒体区：封面 + 截图（独立卡片）*/}
      {post.screenshot_urls && post.screenshot_urls.length > 0 && (
        <MediaGallery coverUrl={null} screenshotUrls={post.screenshot_urls} title={post.title} />
      )}

      {/* 评论区 */}
      <CommentsSection postId={post.id} />
    </div>
  );
}
