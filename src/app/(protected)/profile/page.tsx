import Image from "next/image";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";

export const metadata = { title: "个人主页" };

export default async function ProfilePage() {
  const session = await auth();
  const user = session?.user;

  if (!user) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      {/* 头部卡片 */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {/* 顶部渐变横幅 */}
        <div className="h-28 bg-gradient-to-r from-blue-100 via-violet-100 to-pink-100" />

        {/* 右上角退出登录 */}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
          className="absolute right-4 top-4"
        >
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-full border border-white/60 bg-white/70 px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm backdrop-blur transition hover:bg-white hover:shadow active:scale-95"
          >
                       <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
            退出登录
          </button>
        </form>

        <div className="px-6 pb-6">
          {/* 头像 */}
          <div className="-mt-12 mb-4">
            <span className="inline-flex rounded-full bg-gradient-to-tr from-blue-400 via-violet-400 to-pink-400 p-[3px] shadow-lg shadow-violet-200">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name ?? "用户头像"}
                  width={96}
                  height={96}
                  unoptimized
                  className="size-24 rounded-full border-4 border-white object-cover"
                />
              ) : (
                <span className="grid size-24 place-items-center rounded-full border-4 border-white bg-slate-100 text-3xl font-bold text-slate-500">
                  {user.name?.[0]?.toUpperCase() ?? "U"}
                </span>
              )}
            </span>
          </div>

          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {user.name ?? "用户"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{user.email}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700 active:scale-95"
            >
              编辑资料
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-95"
            >
              控制面板
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}