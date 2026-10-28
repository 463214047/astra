import HeroCarousel from "@/components/hero-carousel";

export type HomePost = {
  id: string;
  category: string;
  title: string;
  subtitle: string | null;
  tags: string[] | null;
  cover_url: string | null;
  screenshot_urls: string[] | null;
  torrent_name: string | null;
  torrent_size: number | null;
  seed_count: number;
  leech_count: number;
  download_count: number;
  favorite_count: number;
  hot: boolean;
  created_at: string;
  author_name: string | null;
  author_email?: string;
  anonymous: boolean;
};

export const metadata = {
  title: "首页",
};

// 首页纯展示轮播图，不需要动态渲染强制
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <HeroCarousel />
    </div>
  );
}
