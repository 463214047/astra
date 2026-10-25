import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "登录 ",
};

export default function LoginPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden p-4">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_18%,var(--brand-200),transparent_34%),radial-gradient(circle_at_82%_78%,var(--brand-100),transparent_36%),linear-gradient(180deg,#ffffff_0%,var(--brand-50)_45%,var(--brand-100)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(var(--brand-100)_1px,transparent_1px),linear-gradient(90deg,var(--brand-100)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(circle_at_center,black,transparent_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed left-[calc(50%-280px)] top-[calc(50%-280px)] size-[560px] rounded-full bg-[radial-gradient(circle,var(--brand-200),transparent_65%)] blur-2xl animate-[float_12s_ease-in-out_infinite_alternate]"
      />
      <LoginForm />
    </main>
  );
}
