import type { Metadata } from "next";
import { AuthBackdrop } from "@/components/auth-backdrop";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "重置密码",
};

export default function ForgotPasswordPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden p-4">
      <AuthBackdrop />
      <ForgotPasswordForm />
    </main>
  );
}
