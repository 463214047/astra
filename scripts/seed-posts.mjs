import { Pool } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const posts = [
  {
    category: "游戏",
    title: "黑神话：悟空 Black Myth Wukong 4K 游戏实录与心得",
    subtitle: "国产 3A 游戏里程碑之作，谈谈我的通关体验",
    tags: ["动作", "国产", "单机"],
    hot: true,
    views: 12580,
    likes: 892,
    comments: 156,
  },
  {
    category: "漫画",
    title: "海贼王 ONE PIECE 最新话分析 - 路飞的觉醒之路",
    subtitle: "1104 话深度解读，大秘宝的真正含义",
    tags: ["热血", "冒险", "连载"],
    hot: true,
    views: 8920,
    likes: 634,
    comments: 98,
  },
  {
    category: "动漫",
    title: "间谍过家家 SPY×FAMILY Season 2 观感分享",
    subtitle: "阿尼亚还是那么可爱，这次主线有点东西",
    tags: ["搞笑", "日常", "温馨"],
    hot: false,
    views: 4530,
    likes: 421,
    comments: 67,
  },
  {
    category: "电影",
    title: "沙丘 Dune Part Two 巨幕观影体验报告",
    subtitle: "IMAX 才是正确的打开方式",
    tags: ["科幻", "史诗", "改编"],
    hot: true,
    views: 15320,
    likes: 1120,
    comments: 203,
  },
  {
    category: "电视剧",
    title: "狂飙 The Knockout - 刑侦剧新标杆",
    subtitle: "张颂文老师演技封神，聊聊这部剧的细节",
    tags: ["刑侦", "国产", "高分"],
    hot: false,
    views: 6780,
    likes: 512,
    comments: 89,
  },
  {
    category: "游戏",
    title: "塞尔达传说 Tears of the Kingdom 新手攻略",
    subtitle: "10 个让游戏体验翻倍的小技巧",
    tags: ["任天堂", "开放世界", "攻略"],
    hot: false,
    views: 3420,
    likes: 298,
    comments: 45,
  },
  {
    category: "动漫",
    title: "葬送的芙莉莲 Frieren 年度最佳番剧预定",
    subtitle: "看完心里空落落的，写点感想",
    tags: ["治愈", "奇幻", "日常"],
    hot: true,
    views: 9870,
    likes: 876,
    comments: 134,
  },
];

async function main() {
  const users = await pool.query("SELECT email, name FROM public.account_users LIMIT 1");
  if (users.rows.length === 0) {
    console.log("No users found");
    await pool.end();
    return;
  }

  const user = users.rows[0];
  const email = user.email;
  const name = user.name || "Astra";

  const existing = await pool.query("SELECT count(*) as cnt FROM public.posts");
  console.log("Existing posts:", existing.rows[0].cnt);

  if (parseInt(existing.rows[0].cnt) >= 8) {
    console.log("Already have enough posts, skipping seed");
    await pool.end();
    return;
  }

  for (const p of posts) {
    await pool.query(
      `INSERT INTO public.posts
       (author_email, author_name, anonymous, category, title, subtitle, content, tags, hot, view_count, like_count, comment_count, status)
       VALUES ($1, $2, false, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'published')`,
      [
        email,
        name,
        p.category,
        p.title,
        p.subtitle,
        "这是内容示例文本，用于测试首页展示效果。",
        p.tags,
        p.hot,
        p.views,
        p.likes,
        p.comments,
      ],
    );
  }

  console.log(`Seeded ${posts.length} new posts`);
  const finalCount = await pool.query("SELECT count(*) as cnt FROM public.posts");
  console.log("Total posts now:", finalCount.rows[0].cnt);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
