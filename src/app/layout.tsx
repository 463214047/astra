import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import Navbar from "@/components/navbar";
import { ThemeProvider } from "@/components/theme-provider";
import { THEME_COOKIE, getTheme, themeStyle } from "@/lib/themes";

export const metadata: Metadata = {
  title: {
    default: "Astra PT",
    template: "%s - Astra PT",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const theme = getTheme(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <html lang="zh-CN" data-theme={theme.id} style={themeStyle(theme)} suppressHydrationWarning>
      <body>
        <ThemeProvider initialTheme={theme.id}>
          <Navbar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
