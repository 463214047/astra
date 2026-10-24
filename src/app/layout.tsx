import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/navbar";

export const metadata: Metadata = {
  title: {
    default: "Astra PT",
    template: "%s - Astra PT",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
