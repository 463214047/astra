import Image from "next/image";
import Link from "next/link";

import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function Navbar() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        {/* 左侧：站点图标 + 名称 */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/icon.png"
            alt="Astra"
            width={28}
            height={28}
            priority
            className="size-7"
          />
          <span className="hidden text-lg font-bold tracking-tight text-slate-900 sm:inline">
            Astra
          </span>
        </Link>

        {/* 中间：搜索框 */}
        <form
          action="/search"
          method="get"
          role="search"
          className="mx-auto w-full max-w-md"
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
              className="h-9 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
            />
          </div>
        </form>

        {/* 右侧：头像 + 悬停下拉卡片 */}
        <div className="shrink-0">
          {user && (
            <div className="group relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-label="用户菜单"
                className="flex cursor-pointer items-center rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name ?? "用户头像"}
                    width={36}
                    height={36}
                    unoptimized
                    className="size-9 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <span className="grid size-9 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
                    {user.name?.[0]?.toUpperCase() ?? "U"}
                  </span>
                )}
              </button>

              <div className="invisible absolute right-0 top-full z-50 pt-2 opacity-0 transition duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5">
                  <div className="flex items-center gap-3 border-b border-slate-100 p-4">
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt={user.name ?? "用户头像"}
                        width={40}
                        height={40}
                        unoptimized
                        className="size-10 shrink-0 rounded-full border border-slate-200 object-cover"
                      />
                    ) : (
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
                        {user.name?.[0]?.toUpperCase() ?? "U"}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {user.name ?? "用户"}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  {/* 操作区 */}
                  <div className="p-2">
                    <Link
                      href="/favorites"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        fill="none"
                        className="size-4 text-slate-400"
                      >
                        <path
                          d="M10 17s-6-3.6-6-8a3.5 3.5 0 0 1 6-2.4A3.5 3.5 0 0 1 16 9c0 4.4-6 8-6 8Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                      </svg>
                      我的收藏
                    </Link>

                    <Link
                      href="/works"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        fill="none"
                        className="size-4 text-slate-400"
                      >
                        <path
                          d="M4 3.5h12v13l-6-3-6 3v-13Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                      </svg>
                      我的作品
                    </Link>

                    {/* 分割线 */}
                    <div className="my-1 border-t border-slate-100" />

                    <form
                      action={async () => {
                        "use server";
                        await signOut({ redirectTo: "/login" });
                      }}
                    >
                      <Button
                        type="submit"
                        variant="ghost"
                        className="w-full justify-start text-sm font-normal text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      >
                        退出登录
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
