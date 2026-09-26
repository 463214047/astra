import Link from "next/link";

export const metadata = { title: "论坛" };

const topics = [
  {
    id: 1,
    title: "MoviePilot怎么用？",
    author: "小林",
    replies: 24,
    views: 312,
    updatedAt: "3 分钟前",
    tag: "求助",
  },
  {
    id: 2,
    title: "M-Team 官方邀请",
    author: "阿泽",
    replies: 18,
    views: 220,
    updatedAt: "12 分钟前",
    tag: "邀请",
  },
];

const tagStyles: Record<string, string> = {
  求助: "bg-blue-50 text-blue-600 ring-blue-100",
  邀请: "bg-violet-50 text-violet-600 ring-violet-100",
};

export default function ForumPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            论坛
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            交流、提问、分享，和同好一起成长
          </p>
        </div>
        <button
          type="button"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 active:scale-95"
        >
          发新帖
        </button>
      </header>

      <ul className="space-y-2">
        {topics.map((t) => (
          <li key={t.id}>
            <Link
              href={`/forum/${t.id}`}
              className="group block rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md hover:shadow-slate-900/5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        tagStyles[t.tag] ?? "bg-slate-50 text-slate-600 ring-slate-100"
                      }`}
                    >
                      {t.tag}
                    </span>
                    <h2 className="truncate text-base font-semibold text-slate-900 transition group-hover:text-slate-700">
                      {t.title}
                    </h2>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {t.author} · {t.updatedAt}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      fill="none"
                      className="size-3.5"
                    >
                      <path
                        d="M4 4.5h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H8l-3.5 2.5V13.5H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {t.replies}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      fill="none"
                      className="size-3.5"
                    >
                      <path
                        d="M10 4.5c-3.5 0-6.5 2.4-8 5.5 1.5 3.1 4.5 5.5 8 5.5s6.5-2.4 8-5.5c-1.5-3.1-4.5-5.5-8-5.5Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx="10"
                        cy="10"
                        r="2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                    {t.views}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}