import Image from "next/image";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "登录",
};

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2.18c-3.2.7-3.88-1.36-3.88-1.36-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.75.4-1.27.73-1.56-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.27 1.19-3.07-.12-.29-.52-1.45.11-3.02 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.57.23 2.73.11 3.02.74.8 1.19 1.82 1.19 3.07 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.04.77 2.1v3.11c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden p-4">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(96,165,250,0.22),transparent_34%),radial-gradient(circle_at_82%_78%,rgba(56,189,248,0.18),transparent_36%),linear-gradient(180deg,#ffffff_0%,#f6f9ff_45%,#eef4ff_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(37,99,235,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.06)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(circle_at_center,black,transparent_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed left-[calc(50%-280px)] top-[calc(50%-280px)] size-[560px] rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.18),transparent_65%)] blur-2xl animate-[float_12s_ease-in-out_infinite_alternate]"
      />

      <Card className="relative z-10 w-full max-w-[420px] gap-0 overflow-hidden rounded-[28px] border border-slate-900/[0.08] bg-white/80 py-0 shadow-[0_24px_60px_rgba(37,99,235,0.10),0_2px_8px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl">
        <CardContent className="flex flex-col items-center px-8 pb-7 pt-10 text-center">
          <div className="mb-5 flex size-28 items-center justify-center rounded-full bg-gradient-to-br from-[#2563eb] to-[#38bdf8] p-[3px] shadow-[0_12px_28px_rgba(37,99,235,0.28)]">
            <Image
              src="/icon.png"
              alt="Astra PT"
              width={112}
              height={112}
              priority
              unoptimized
              className="h-full w-full rounded-full border-[3px] border-white object-cover"
            />
          </div>

          <h1 className="mb-7 text-[28px] font-bold tracking-[-0.03em] text-[#0b1220]">
            Astra PT
          </h1>

          <form
            className="w-full"
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/" });
            }}
          >
            <Button
              type="submit"
              className="h-[52px] w-full gap-2.5 rounded-[14px] bg-[#0b1220] text-[15px] font-bold text-white shadow-[0_12px_26px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:bg-[#111827] hover:shadow-[0_18px_36px_rgba(37,99,235,0.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] active:translate-y-0"
            >
              <GitHubIcon className="size-5" />
              使用 GitHub 继续
            </Button>
          </form>

          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            登录即表示你同意{" "}
            <a
              href="/rules"
              className="font-semibold text-[#2563eb] hover:underline"
            >
              规则
            </a>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
