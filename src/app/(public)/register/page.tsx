import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = {
  title: "注册",
};

export default function RegisterPage() {
  return (
    <AuthShell>
      <RegisterForm />
    </AuthShell>
  );
}
