import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import Navbar from "@/components/navbar";
import { LanguageProvider } from "@/components/language-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { BACKGROUND_COOKIE, backgroundStyle, getBackground } from "@/lib/backgrounds";
import { LOCALE_COOKIE, getLocale } from "@/lib/i18n";
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
  const background = getBackground(cookieStore.get(BACKGROUND_COOKIE)?.value);
  const locale = getLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return (
    <html
      lang={locale}
      data-locale={locale}
      data-theme={theme.id}
      data-background={background.id}
      style={themeStyle(theme)}
      suppressHydrationWarning
    >
      <body className="min-h-dvh" style={backgroundStyle(background)}>
        <ThemeProvider initialTheme={theme.id} initialBackground={background.id}>
          <LanguageProvider initialLocale={locale}>
            <Navbar />
            {children}
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
