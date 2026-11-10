import type { Metadata } from "next";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth-shell";
import ResetPasswordClient from "./ResetPasswordClient";

export const metadata: Metadata = {
  title: "重置密码 ",
};

export default async function ResetPasswordPage() {
  const session = await auth();
  return (
    <AuthShell>
      <ResetPasswordClient email={session?.user?.email ?? null} />
    </AuthShell>
  );
}
