import type { CSSProperties } from "react";

export type Background = {
  id: string;
  label: string;
  style: CSSProperties;
};

export const BACKGROUND_COOKIE = "astra-background";

export const BACKGROUNDS = [
  {
    id: "white",
    label: "纯白",
    style: {
      backgroundColor: "#ffffff",
      backgroundImage: "none",
      backgroundAttachment: "scroll",
      backgroundSize: "auto",
    },
  },
  {
    id: "mist",
    label: "雾灰",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: "none",
      backgroundAttachment: "scroll",
      backgroundSize: "auto",
    },
  },
  {
    id: "glow",
    label: "柔光",
    style: {
      backgroundColor: "#ffffff",
      backgroundImage:
        "radial-gradient(circle at 12% 8%, var(--brand-100), transparent 32%), radial-gradient(circle at 88% 92%, var(--brand-50), transparent 38%)",
      backgroundAttachment: "fixed",
      backgroundSize: "auto",
    },
  },
  {
    id: "grid",
    label: "网格",
    style: {
      backgroundColor: "#ffffff",
      backgroundImage:
        "linear-gradient(to right, var(--brand-100) 1px, transparent 1px), linear-gradient(to bottom, var(--brand-100) 1px, transparent 1px)",
      backgroundAttachment: "fixed",
      backgroundSize: "32px 32px",
    },
  },
] as const satisfies readonly Background[];

export type BackgroundId = (typeof BACKGROUNDS)[number]["id"];

export const DEFAULT_BACKGROUND: BackgroundId = "white";

export function getBackground(id?: string | null): (typeof BACKGROUNDS)[number] {
  return BACKGROUNDS.find((background) => background.id === id) ?? BACKGROUNDS[0];
}

export function backgroundStyle(background: Pick<Background, "style">): CSSProperties {
  return background.style;
}

export function backgroundPreviewStyle(
  background: Pick<Background, "id" | "style">,
): CSSProperties {
  return {
    ...background.style,
    backgroundAttachment: "scroll",
    backgroundSize: background.id === "grid" ? "10px 10px" : "auto",
  };
}
