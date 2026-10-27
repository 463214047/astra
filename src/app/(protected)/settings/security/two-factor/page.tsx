import type { Metadata } from "next";
import SecurityClient from "../SecurityClient";

export const metadata: Metadata = {
  title: "两步验证",
};

export default function TwoFactorSecurityPage() {
  return <SecurityClient mode="two-factor" />;
}
