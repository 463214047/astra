"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SearchInput from "./search-input";

type Props = {
  loggedIn: boolean;
  userImage: string | null;
  userName: string | null;
  myUid: number | null;
  unreadTotal: number;
};

export default function NavbarInner({ loggedIn, userImage, userName, myUid, unreadTotal }: Props) {
  const pathname = usePathname();
  // 未登录时不显示顶部导航栏；登录、注册、重置密码页也不显示
  if (
    !loggedIn ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password")
  ) {
    return null;
  }

  const hasNew = unreadTotal > 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        {/* 左侧：站点图标 + 名称 */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/icon.png"
            alt="Astra PT"
            width={28}
            height={28}
            priority
            unoptimized
            className="size-7"
          />
          <span className="hidden text-lg font-bold tracking-tight text-slate-900 sm:inline">
            Astra PT
          </span>
        </Link>

        {/* 中间：资源 + 游戏 + 论坛 + 搜索 */}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          {/* 资源入口 */}
          <Link
            href="/torrents"
            aria-label="资源"
            className="group/torrents grid size-10 shrink-0 place-items-center rounded-full text-slate-500 outline-none ring-offset-2 transition-all duration-300 hover:scale-110 hover:bg-slate-100 hover:text-slate-900 active:scale-95 focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="size-7 transition-transform duration-300 group-hover/torrents:-translate-y-0.5"
            >
              <rect
                x="2.5"
                y="4.5"
                width="19"
                height="15"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path d="M2 9.5h20" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="18" cy="14.5" r="1" fill="currentColor" />
            </svg>
          </Link>

          {/* 游戏入口 */}
          <Link
            href="/game"
            aria-label="游戏"
            className="group/game grid size-10 shrink-0 place-items-center rounded-full text-slate-500 outline-none ring-offset-2 transition-all duration-300 hover:scale-110 hover:bg-slate-100 hover:text-slate-900 active:scale-95 focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="size-7 transition-transform duration-300 group-hover/game:-translate-y-0.5"
            >
              <path
                d="M6 11h4M8 9v4M15 12h.01M18 10h.01M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          {/* 论坛入口 */}
          <Link
            href="/forum"
            aria-label="论坛"
            className="group/forum grid size-10 shrink-0 place-items-center rounded-full text-slate-500 outline-none ring-offset-2 transition-all duration-300 hover:scale-110 hover:bg-slate-100 hover:text-slate-900 active:scale-95 focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="size-7 transition-transform duration-300 group-hover/forum:-translate-y-0.5"
            >
              <path
                d="M4 4.5h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H8l-3.5 2.5V13.5H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M6.5 8h7M6.5 10.5h4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </Link>

          {/* 搜索框（带历史记录） */}
          <SearchInput />
        </div>

        {/* 右侧：上传 + 消息 + 头像 */}
        <div className="flex shrink-0 items-center gap-3">
          {/* 上传 */}
          <Link
            href="/upload"
            aria-label="上传"
            className="group/upload grid size-10 shrink-0 place-items-center rounded-full text-slate-500 outline-none ring-offset-2 transition-all duration-300 hover:scale-110 hover:bg-slate-100 hover:text-slate-900 active:scale-95 focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="size-7 transition-transform duration-300 group-hover/upload:-translate-y-0.5"
            >
              <rect
                x="3.5"
                y="3.5"
                width="17"
                height="17"
                rx="4"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M12 16V9m0 0-3 3m3-3 3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          {/* 消息 */}
          <Link
            href="/messages"
            aria-label={hasNew ? "我的消息（有新消息）" : "我的消息"}
            className={`group/msg relative grid size-10 place-items-center rounded-full outline-none ring-offset-2 transition-all duration-300 hover:scale-110 active:scale-95 focus-visible:ring-2 focus-visible:ring-slate-400 ${
              hasNew
                ? "text-brand-700 hover:bg-brand-50 hover:text-brand-800"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="size-7 origin-top transition-transform duration-200 group-hover/msg:animate-bell-ring"
            >
              <path
                d="M10 2.5a5 5 0 0 0-5 5v3l-1.2 2.2a.5.5 0 0 0 .4.8h11.6a.5.5 0 0 0 .4-.8L15 10.5v-3a5 5 0 0 0-5-5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M8 15.5a2 2 0 0 0 4 0"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            {hasNew && (
              <span
                aria-hidden="true"
                className="absolute right-2 top-2 size-2 rounded-full bg-brand-500 ring-2 ring-white transition-transform duration-300 group-hover/msg:scale-125"
              />
            )}
          </Link>

          {/* 头像 */}
          <div className="group relative">
            <Link
              href={myUid ? `/users/${myUid}` : "/login"}
              aria-label={loggedIn ? "个人主页" : "登录"}
              className="flex items-center rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <span className="relative inline-flex rounded-full bg-gradient-to-tr from-slate-300 via-slate-200 to-slate-300 p-[2px] transition-all duration-300 group-hover:from-brand-400 group-hover:via-brand-500 group-hover:to-brand-600 group-hover:shadow-lg group-hover:shadow-brand-300/50">
                {userImage ? (
                  <Image
                    src={userImage}
                    alt={userName ?? "用户头像"}
                    width={36}
                    height={36}
                    unoptimized
                    className="size-9 rounded-full border-2 border-white object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : userName ? (
                  <span className="grid size-9 place-items-center rounded-full border-2 border-white bg-slate-100 text-sm font-semibold text-slate-500 transition-transform duration-300 group-hover:scale-105">
                    {userName[0].toUpperCase()}
                  </span>
                ) : (
                  <span className="grid size-9 place-items-center rounded-full border-2 border-white bg-slate-100 text-slate-400 transition-transform duration-300 group-hover:scale-105">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
                      <path
                        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                )}
              </span>
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
