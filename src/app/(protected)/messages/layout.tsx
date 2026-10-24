import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "消息中心",
};

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
