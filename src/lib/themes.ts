import type { CSSProperties } from "react";

export type ThemePalette = Record<
  "50" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900" | "950",
  string
>;

export type Theme = {
  id: string;
  label: string;
  description: string;
  swatch: string;
  colors: ThemePalette;
};

export const THEME_COOKIE = "astra-theme";

export const THEMES = [
  {
    id: "violet",
    label: "紫罗兰",
    description: "默认 · 冷静、克制",
    swatch: "from-violet-500 to-violet-700",
    colors: {
      "50": "#f5f3ff",
      "100": "#ede9fe",
      "200": "#ddd6fe",
      "300": "#c4b5fd",
      "400": "#a78bfa",
      "500": "#8b5cf6",
      "600": "#7c3aed",
      "700": "#6d28d9",
      "800": "#5b21b6",
      "900": "#4c1d95",
      "950": "#2e1065",
    },
  },
  {
    id: "blue",
    label: "海洋蓝",
    description: "清晰、可靠",
    swatch: "from-blue-500 to-blue-700",
    colors: {
      "50": "#eff6ff",
      "100": "#dbeafe",
      "200": "#bfdbfe",
      "300": "#93c5fd",
      "400": "#60a5fa",
      "500": "#3b82f6",
      "600": "#2563eb",
      "700": "#1d4ed8",
      "800": "#1e40af",
      "900": "#1e3a8a",
      "950": "#172554",
    },
  },
  {
    id: "emerald",
    label: "翡翠绿",
    description: "清新、自然",
    swatch: "from-emerald-500 to-emerald-700",
    colors: {
      "50": "#ecfdf5",
      "100": "#d1fae5",
      "200": "#a7f3d0",
      "300": "#6ee7b7",
      "400": "#34d399",
      "500": "#10b981",
      "600": "#047857",
      "700": "#065f46",
      "800": "#064e3b",
      "900": "#022c22",
      "950": "#011c17",
    },
  },
  {
    id: "rose",
    label: "玫瑰红",
    description: "鲜明、有活力",
    swatch: "from-rose-500 to-rose-700",
    colors: {
      "50": "#fff1f2",
      "100": "#ffe4e6",
      "200": "#fecdd3",
      "300": "#fda4af",
      "400": "#fb7185",
      "500": "#f43f5e",
      "600": "#be123c",
      "700": "#9f1239",
      "800": "#881337",
      "900": "#4c0519",
      "950": "#3f0414",
    },
  },
  {
    id: "amber",
    label: "琥珀橙",
    description: "温暖、醒目",
    swatch: "from-amber-500 to-amber-700",
    colors: {
      "50": "#fffbeb",
      "100": "#fef3c7",
      "200": "#fde68a",
      "300": "#fcd34d",
      "400": "#fbbf24",
      "500": "#f59e0b",
      "600": "#b45309",
      "700": "#92400e",
      "800": "#78350f",
      "900": "#451a03",
      "950": "#381502",
    },
  },
  {
    id: "slate",
    label: "石墨灰",
    description: "低调、极简",
    swatch: "from-slate-500 to-slate-700",
    colors: {
      "50": "#f8fafc",
      "100": "#f1f5f9",
      "200": "#e2e8f0",
      "300": "#cbd5e1",
      "400": "#94a3b8",
      "500": "#64748b",
      "600": "#475569",
      "700": "#334155",
      "800": "#1e293b",
      "900": "#0f172a",
      "950": "#020617",
    },
  },
] as const satisfies readonly Theme[];

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "violet";

export function getTheme(id?: string | null): (typeof THEMES)[number] {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

export function themeStyle(theme: Pick<Theme, "colors">): CSSProperties {
  return Object.fromEntries(
    Object.entries(theme.colors).map(([shade, value]) => [`--brand-${shade}`, value]),
  ) as CSSProperties;
}
