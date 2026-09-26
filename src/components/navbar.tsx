import Image from "next/image";
import Link from "next/link";

import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function Navbar() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* 左侧：站点图标 + 名称 */}
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/icon.png"
            alt="Astra"
            width={28}
            height={28}
            priority
            className="size-7"
          />
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Astra
          </span>
        </Link>

        {/* 右侧：头像 + 悬停下拉卡片 */}
        {user ? (
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

            {/*
              下拉卡片：
              - pt-2 作为“悬停桥接”，鼠标从头像移到卡片上时不会闪断
              - group-focus-within 让键盘 Tab 也能打开
            */}
            <div className="invisible absolute right-0 top-full z-50 pt-2 opacity-0 transition duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <div className="w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5">
                {/* 用户信息 */}
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
        ) : (
          <Link
            href="/login"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            登录
          </Link>
        )}
      </nav>
    </header>
  );
}