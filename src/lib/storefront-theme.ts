import type { CSSProperties } from "react";
import type { StoreTheme } from "@/lib/types";

export interface ThemeClasses {
  page: string;
  heading: string;
  eyebrow: string;
  surface: string;
  button: string;
  buttonGhost: string;
  hero: string;
  heroText: string;
}

/**
 * Maps a store's saved theme to a small set of storefront classes. The raw
 * colours are injected as CSS custom properties so Tailwind arbitrary values
 * (e.g. bg-[var(--store-primary)]) stay in sync with the admin settings.
 */
export function themeVars(theme: StoreTheme): CSSProperties {
  return {
    "--store-primary": theme.primary,
    "--store-accent": theme.accent,
  } as CSSProperties;
}

export function themeClasses(style: StoreTheme["style"]): ThemeClasses {
  switch (style) {
    case "editorial":
      return {
        page: "bg-[#FBF9F4] text-ink-900",
        heading: "font-serif tracking-[-0.02em]",
        eyebrow:
          "text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--store-accent)]",
        surface: "border-ink-900/10 bg-white/80",
        button:
          "bg-[var(--store-primary)] text-white hover:opacity-90 active:opacity-95",
        buttonGhost:
          "border border-ink-900/15 bg-transparent text-ink-800 hover:bg-ink-900/5",
        hero: "bg-[#F4EFE4]",
        heroText: "text-ink-900",
      };
    case "bold":
      return {
        page: "bg-white text-ink-950",
        heading: "font-semibold uppercase tracking-[-0.04em]",
        eyebrow:
          "text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--store-accent)]",
        surface: "border-ink-950/10 bg-white",
        button:
          "bg-[var(--store-primary)] text-white hover:opacity-90 active:opacity-95",
        buttonGhost:
          "border border-ink-950/15 bg-transparent text-ink-900 hover:bg-ink-950/5",
        hero: "bg-[var(--store-primary)]",
        heroText: "text-white",
      };
    default:
      return {
        page: "bg-white text-ink-900",
        heading: "tracking-[-0.035em]",
        eyebrow:
          "text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--store-accent)]",
        surface: "border-ink-100 bg-white",
        button:
          "bg-[var(--store-primary)] text-white hover:opacity-90 active:opacity-95",
        buttonGhost:
          "border border-ink-200 bg-white text-ink-700 hover:bg-ink-50",
        hero: "bg-[#F6F7F9]",
        heroText: "text-ink-900",
      };
  }
}

export function heroHeadline(style: StoreTheme["style"], name: string): string {
  if (style === "editorial") return name;
  if (style === "bold") return name.toUpperCase();
  return name;
}
