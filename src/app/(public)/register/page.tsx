import type { Metadata } from "next";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = {
  title: "注册",
};

export default function RegisterPage() {
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
      <RegisterForm />
    </main>
  );
}
