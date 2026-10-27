import type { Metadata } from "next";
import { AuthBackdrop } from "@/components/auth-backdrop";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "登录 ",
};

export default function LoginPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden p-4">
      <AuthBackdrop />
      <LoginForm />
    </main>
  );
}
