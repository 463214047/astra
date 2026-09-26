import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "消息" };

const conversations = [
  {
    id: 1,
    name: "Administrator",
    avatar: null,
    lastMessage: "你好，我是 Administrator",
    time: "3 分钟前",
    unread: 2,
  },
  {
    id: 2,
    name: "M-Team",
    avatar: null,
    lastMessage: "邀请你加入项目 M-Team ！",
    time: "12 分钟前",
    unread: 0,
  },
];

export default function MessagesPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          消息
        </h1>
        <p className="mt-1 text-sm text-slate-500">和好友、协作者的对话</p>
      </header>

      <ul className="space-y-1">
        {conversations.map((c) => (
          <li key={c.id}>
            <Link
              href={`/messages/${c.id}`}
              className="group flex items-center gap-3 rounded-xl p-3 transition-colors duration-150 hover:bg-slate-50"
            >
              {/* 头像 */}
              <div className="relative shrink-0">
                {c.avatar ? (
                  <Image
                    src={c.avatar}
                    alt={c.name}
                    width={44}
                    height={44}
                    unoptimized
                    className="size-11 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid size-11 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
                    {c.name[0].toUpperCase()}
                  </span>
                )}
                {c.unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-violet-500 ring-2 ring-white" />
                )}
              </div>

              {/* 内容 */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`truncate text-sm ${
                      c.unread > 0
                        ? "font-semibold text-slate-900"
                        : "font-medium text-slate-700"
                    }`}
                  >
                    {c.name}
                  </p>
                  <span className="shrink-0 text-xs text-slate-400">
                    {c.time}
                  </span>
                </div>
                <p
                  className={`mt-0.5 truncate text-sm ${
                    c.unread > 0 ? "text-slate-700" : "text-slate-500"
                  }`}
                >
                  {c.lastMessage}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
