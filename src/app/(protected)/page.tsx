import HeroCarousel from "@/components/hero-carousel";

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
