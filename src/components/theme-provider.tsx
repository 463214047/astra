"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { THEMES, THEME_COOKIE, getTheme, themeStyle, type ThemeId } from "@/lib/themes";

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  themes: typeof THEMES;
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

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: ThemeId;
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemeId>(initialTheme);

  const setTheme = useCallback((id: ThemeId) => {
    const next = getTheme(id);
    applyTheme(next.id);
    setThemeState(next.id);
  }, []);

  const value = useMemo(() => ({ theme, setTheme, themes: THEMES }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
