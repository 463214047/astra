import Link from "next/link";

export const metadata = {
  title: "首页",
};

// ---------- 数据类型 ----------
type Category = "游戏" | "漫画" | "动漫" | "电影" | "电视剧";

type Post = {
  id: number;
  title: string;
  excerpt: string;
  category: Category;
  cover: string; // 渐变色，避免依赖外部图片
  author: string;
  likes: number;
  comments: number;
};

// ---------- 分类配置 ----------
const categories: {
  key: Category | "全部";
  href: string;
}[] = [
  { key: "全部", href: "/" },
  { key: "游戏", href: "/?category=game" },
  { key: "漫画", href: "/?category=comic" },
  { key: "动漫", href: "/?category=anime" },
  { key: "电影", href: "/?category=movie" },
  { key: "电视剧", href: "/?category=tv" },
];

// 每个分类对应的标签样式
const tagStyles: Record<Category, string> = {
  游戏: "bg-blue-50 text-blue-600 ring-blue-100",
  漫画: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  动漫: "bg-violet-50 text-violet-600 ring-violet-100",
  电影: "bg-amber-50 text-amber-600 ring-amber-100",
  电视剧: "bg-rose-50 text-rose-600 ring-rose-100",
};

// ---------- 假数据 ----------
const posts: Post[] = [
  {
    id: 1,
    title: "《塞尔达传说：王国之泪》到底值不值得入手？",
    excerpt:
      "从天空到地底，无缝的探索体验让人欲罢不能。这篇聊聊它相比前作的变化，以及新手应该注意的几个坑。",
    category: "游戏",
    cover: "from-sky-400 to-indigo-500",
    author: "小林",
    likes: 328,
    comments: 42,
  },
  {
    id: 2,
    title: "《葬送的芙莉莲》：一部关于时间的温柔作品",
    excerpt:
      "它不急着打怪升级，而是用一个个小故事讲“告别”。看完第一集，我沉默了整整十分钟。",
    category: "动漫",
    cover: "from-violet-400 to-fuchsia-500",
    author: "阿泽",
    likes: 512,
    comments: 88,
  },
  {
    id: 3,
    title: "《蜘蛛侠：纵横宇宙》的视觉为什么这么炸？",
    excerpt:
      "每个宇宙都有自己的画风，2D、3D、水彩、美漫混搭。聊聊它如何把美术风格变成叙事的一部分。",
    category: "电影",
    cover: "from-rose-400 to-orange-400",
    author: "Kevin",
    likes: 276,
    comments: 35,
  },
  {
    id: 4,
    title: "《电锯人》漫画后半段，藤本树到底想表达什么？",
    excerpt:
      "从少年漫的外壳下，藏着一个关于孤独与渴望的故事。这篇试着拆解几个关键意象。",
    category: "漫画",
    cover: "from-red-400 to-rose-600",
    author: "Momo",
    likes: 445,
    comments: 67,
  },
  {
    id: 5,
    title: "《漫长的季节》：国产剧里少见的文学性",
    excerpt:
      "三条时间线交织，东北的秋天又冷又长。它讲的不只是案子，更是一代人的命运。",
    category: "电视剧",
    cover: "from-amber-400 to-yellow-600",
    author: "老周",
    likes: 389,
    comments: 54,
  },
  {
    id: 6,
    title: "《艾尔登法环》DLC 通关后的碎碎念",
    excerpt:
      "难度依旧劝退，但黄金树背后的故事补全了很多空白。给还在犹豫要不要买的朋友一点参考。",
    category: "游戏",
    cover: "from-amber-500 to-orange-700",
    author: "小林",
    likes: 298,
    comments: 39,
  },
  {
    id: 7,
    title: "《蓝色时期》：把艺考的痛画得太真实了",
    excerpt:
      "不是天才的主角，靠着一点执念往前冲。每一个为热爱拼过命的人，都能在里面看到自己。",
    category: "漫画",
    cover: "from-blue-400 to-cyan-500",
    author: "阿泽",
    likes: 231,
    comments: 28,
  },
  {
    id: 8,
    title: "《赛博朋克：边缘行者》：十集讲完一生的悲剧",
    excerpt:
      "夜之城的霓虹再美，也照不亮底层的命运。这部动画把“惨”拍出了一种诗意。",
    category: "动漫",
    cover: "from-yellow-400 to-pink-500",
    author: "Kevin",
    likes: 467,
    comments: 73,
  },
];

// ---------- 页面 ----------
export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* 分类导航 */}
      <nav className="mb-6 flex flex-wrap gap-2">
        {categories.map((c, i) => (
          <Link
            key={c.key}
            href={c.href}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              i === 0
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {c.key}
          </Link>
        ))}
      </nav>

      {/* 内容网格 */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/post/${post.id}`}
            className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/5"
          >
            {/* 封面（渐变占位） */}
            <div
              className={`relative aspect-[16/9] bg-gradient-to-br ${post.cover}`}
            >
              <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-slate-700 backdrop-blur">
                {post.category}
              </span>
            </div>

            {/* 内容 */}
            <div className="flex flex-1 flex-col p-4">
              <h2 className="line-clamp-2 text-base font-semibold leading-snug text-slate-900 transition group-hover:text-slate-700">
                {post.title}
              </h2>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">
                {post.excerpt}
              </p>

              {/* 底部信息 */}
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>{post.author}</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      fill="none"
                      className="size-3.5"
                    >
                      <path
                        d="M10 16s-5.5-3.3-5.5-7.3a3.2 3.2 0 0 1 5.5-2.2 3.2 3.2 0 0 1 5.5 2.2c0 4-5.5 7.3-5.5 7.3Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {post.likes}
                  </span>
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
                    {post.comments}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* 加载更多 */}
      <div className="mt-10 flex justify-center">
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-6 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-95"
        >
          加载更多
        </button>
      </div>
    </div>
  );
}
