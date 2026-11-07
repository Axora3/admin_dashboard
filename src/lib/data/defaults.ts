import type { StoreSettingsData, ThemeStyle } from "@/lib/types";

const THEME_PRESETS: Record<ThemeStyle, { primary: string; accent: string }> = {
  minimal: { primary: "#111827", accent: "#3562F5" },
  editorial: { primary: "#1F2937", accent: "#C9A227" },
  bold: { primary: "#0F172A", accent: "#F97316" },
};

export function defaultStoreSettings(
  style: ThemeStyle = "minimal",
  overrides: Partial<StoreSettingsData> = {},
): StoreSettingsData {
  const preset = THEME_PRESETS[style] ?? THEME_PRESETS.minimal;
  return {
    social: { facebook: "", instagram: "", ...(overrides.social ?? {}) },
    theme: { primary: preset.primary, accent: preset.accent, style, ...(overrides.theme ?? {}) },
    shipping: {
      enabled: true,
      flatRate: 5000,
      freeOver: 200000,
      note: "Улаанбаатар хот дотор 1–2 ажлын өдөрт хүргэнэ.",
      ...(overrides.shipping ?? {}),
    },
    payment: {
      codEnabled: true,
      bankTransferEnabled: true,
      bankAccount: "",
      note: "",
      ...(overrides.payment ?? {}),
    },
    visibility: {
      published: true,
      showOutOfStock: false,
      ...(overrides.visibility ?? {}),
    },
  };
}
