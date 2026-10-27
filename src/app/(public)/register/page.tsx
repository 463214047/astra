import type { Metadata } from "next";
import { AuthBackdrop } from "@/components/auth-backdrop";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = {
  title: "注册",
};

export default function RegisterPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden p-4">
      <AuthBackdrop />
      <RegisterForm />
    </main>
  );
}
