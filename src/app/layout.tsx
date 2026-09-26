import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Ayaka",
    template: "%s - Ayaka",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
