import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";

export default async function Navbar() {
  const hasNew = true;
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        {/* 左侧：站点图标 + 名称 */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/icon.png"
            alt="Astra"
            width={28}
            height={28}
            priority
            unoptimized
            className="size-7"
          />
          <span className="hidden text-lg font-bold tracking-tight text-slate-900 sm:inline">
            Astra
          </span>
        </Link>

        {/* 中间：论坛 + 搜索，整组居中 */}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
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
              className="size-7 transition-transform duration-300 group-hover/forum:-rotate-6"
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

          {/* 搜索框 */}
          <form
            action="/search"
            method="get"
            role="search"
            className="w-full min-w-0 max-w-md"
          >
            <div className="relative">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              >
                <path
                  d="M9 3a6 6 0 1 0 3.7 10.7l3.3 3.3a1 1 0 0 0 1.4-1.4l-3.3-3.3A6 6 0 0 0 9 3Zm-4 6a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
                  fill="currentColor"
                />
              </svg>
              <input
                type="search"
                name="q"
                placeholder="搜索…"
                aria-label="搜索"
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
              />
            </div>
          </form>
        </div>

        {/* 右侧：消息 + 头像（完全保持原样） */}
        <div className="flex shrink-0 items-center gap-3">
          {user && (
            <>
              <Link
                href="/messages"
                aria-label={hasNew ? "我的消息（有新消息）" : "我的消息"}
                className={`group/msg relative grid size-10 place-items-center rounded-full outline-none ring-offset-2 transition-all duration-300 hover:scale-110 active:scale-95 focus-visible:ring-2 focus-visible:ring-slate-400 ${
                  hasNew
                    ? "text-violet-600 hover:bg-violet-50 hover:text-violet-700"
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
                  <span className="absolute right-2 top-2 size-2 rounded-full bg-violet-500 ring-2 ring-white transition-transform duration-300 group-hover/msg:scale-125" />
                )}
              </Link>

              <div className="group relative">
                <Link
                  href="/profile"
                  aria-label="个人中心"
                  className="flex items-center rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <span className="relative inline-flex rounded-full bg-gradient-to-tr from-slate-300 via-slate-200 to-slate-300 p-[2px] transition-all duration-300 group-hover:from-blue-400 group-hover:via-violet-400 group-hover:to-pink-400 group-hover:shadow-lg group-hover:shadow-violet-300/50">
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt={user.name ?? "用户头像"}
                        width={36}
                        height={36}
                        unoptimized
                        className="size-9 rounded-full border-2 border-white object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <span className="grid size-9 place-items-center rounded-full border-2 border-white bg-slate-100 text-sm font-semibold text-slate-500 transition-transform duration-300 group-hover:scale-105">
                        {user.name?.[0]?.toUpperCase() ?? "U"}
                      </span>
                    )}
                  </span>
                </Link>
              </div>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
