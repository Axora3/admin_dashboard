import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0B0D10",
          900: "#121519",
          800: "#1B1F25",
          700: "#2A3038",
          600: "#3D4551",
          500: "#5A6472",
          400: "#7C8798",
          300: "#A6AFBC",
          200: "#CBD2DB",
          100: "#E6EAF0",
          50: "#F4F6F9",
        },
        brand: {
          50: "#EEF3FF",
          100: "#DCE6FF",
          200: "#B9CDFF",
          300: "#8CACFF",
          400: "#5C86FF",
          500: "#3562F5",
          600: "#2148D8",
          700: "#1A38AE",
          800: "#182F89",
          900: "#172B6E",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F7F8FA",
          sunken: "#F1F3F6",
        },
        success: {
          50: "#ECFDF3",
          100: "#D1FADF",
          600: "#039855",
          700: "#027A48",
        },
        warning: {
          50: "#FFFAEB",
          100: "#FEF0C7",
          600: "#DC6803",
          700: "#B54708",
        },
        danger: {
          50: "#FEF3F2",
          100: "#FEE4E2",
          600: "#D92D20",
          700: "#B42318",
        },
        info: {
          50: "#EFF8FF",
          100: "#D1E9FF",
          600: "#1570EF",
          700: "#175CD3",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "SF Pro Text",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["SFMono-Regular", "Menlo", "Consolas", "Liberation Mono", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.01em" }],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(16,24,40,0.04), 0 1px 3px 0 rgba(16,24,40,0.06)",
        raised:
          "0 4px 8px -2px rgba(16,24,40,0.06), 0 12px 24px -4px rgba(16,24,40,0.08)",
        overlay:
          "0 24px 48px -12px rgba(16,24,40,0.18), 0 8px 16px -8px rgba(16,24,40,0.1)",
        focus: "0 0 0 3px rgba(53,98,245,0.16)",
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 160ms ease-out",
        "slide-in": "slide-in 160ms ease-out",
        "scale-in": "scale-in 120ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
