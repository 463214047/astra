"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  BACKGROUNDS,
  BACKGROUND_COOKIE,
  backgroundStyle,
  getBackground,
  type BackgroundId,
} from "@/lib/backgrounds";
import { THEMES, THEME_COOKIE, getTheme, themeStyle, type ThemeId } from "@/lib/themes";

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  themes: typeof THEMES;
  background: BackgroundId;
  setBackground: (background: BackgroundId) => void;
  backgrounds: typeof BACKGROUNDS;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(id: ThemeId) {
  const theme = getTheme(id);
  const root = document.documentElement;

  root.dataset.theme = theme.id;
  for (const [key, value] of Object.entries(themeStyle(theme))) {
    root.style.setProperty(key, String(value));
  }
  document.cookie = `${THEME_COOKIE}=${theme.id}; path=/; max-age=31536000; samesite=lax`;
}

function applyBackground(id: BackgroundId) {
  const background = getBackground(id);

  Object.assign(document.body.style, backgroundStyle(background));
  document.documentElement.dataset.background = background.id;
  document.cookie = `${BACKGROUND_COOKIE}=${background.id}; path=/; max-age=31536000; samesite=lax`;
}

export function ThemeProvider({
  initialTheme,
  initialBackground,
  children,
}: {
  initialTheme: ThemeId;
  initialBackground: BackgroundId;
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemeId>(initialTheme);
  const [background, setBackgroundState] = useState<BackgroundId>(initialBackground);

  const setTheme = useCallback((id: ThemeId) => {
    const next = getTheme(id);
    applyTheme(next.id);
    setThemeState(next.id);
  }, []);

  const setBackground = useCallback((id: BackgroundId) => {
    const next = getBackground(id);
    applyBackground(next.id);
    setBackgroundState(next.id);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      themes: THEMES,
      background,
      setBackground,
      backgrounds: BACKGROUNDS,
    }),
    [theme, setTheme, background, setBackground],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
