import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "登录 ",
};

export default function LoginPage() {
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}
