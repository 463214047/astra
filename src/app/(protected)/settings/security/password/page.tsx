import type { Metadata } from "next";
import SecurityClient from "../SecurityClient";

export const metadata: Metadata = {
  title: "重设密码",
};

export default function PasswordSecurityPage() {
  return <SecurityClient mode="password" />;
}
