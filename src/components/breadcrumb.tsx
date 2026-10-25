import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * 全站面包屑 — 精致小胶囊风格
 *
 * 用法:
 *   <Breadcrumb items={[
 *     { label: "首页", href: "/" },
 *     { label: "电影", href: "/?category=电影" },
 *     { label: post.title },
 *   ]} />
 */
export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (!items.length) return null;

  return (
    <nav aria-label="面包屑" className="mb-5 flex flex-wrap items-center gap-1.5 text-[13px]">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;

        return (
          <span key={i} className="flex items-center gap-1.5">
            {/* 分隔符 — 第一个元素前面不显示 */}
            {i > 0 && (
              <svg
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
                className="size-3 text-slate-300"
              >
                <path
                  d="M4.5 3L7.5 6L4.5 9"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}

            {isLast || !item.href ? (
              // 最后一级 / 无链接 → 当前页
              <span className="font-medium text-slate-700 truncate max-w-[240px]">
                {item.label}
              </span>
            ) : (
              // 可点击 — 带首页小图标（只给第一级首页）
              <Link
                href={item.href}
                className="text-slate-500 hover:text-slate-900 hover:underline underline-offset-4 transition-colors truncate max-w-[200px]"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
