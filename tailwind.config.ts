import type { Config } from "tailwindcss";

/**
 * Design tokens — hybrid direction (Kabue, 2026-10-23):
 *
 * Direction A "Restrained Dark Editorial" is the app-wide theme:
 * near-black ink surfaces, quiet 1px borders, a serif display face
 * (font-display, Spectral via --font-display) and a single copper accent.
 * The `copper` scale replaces the old cyan `aurora` accent everywhere;
 * `gold` and `violet` survive only as semantic status colours.
 *
 * Direction B "Light Clinical" is scoped to the report surface via the
 * `paper` tokens (white sheet, deep teal accent from Tailwind's teal
 * scale, anchored at teal-700 #0F766E) — see components/reports/.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // Direction A surfaces — flat near-black ink, no glow gradients.
        midnight: "#08080a",
        ink: "#0d0d10",
        panel: "#141417",
        line: "#27272c",
        // Legacy accent token name; now carries the copper accent.
        aurora: "#b87333",
        // Copper accent scale (anchor: #b87333 at 500).
        copper: {
          50: "#faf3eb",
          100: "#f2e2ce",
          200: "#e4c294",
          300: "#d9a05f",
          400: "#c98a45",
          500: "#b87333",
          600: "#9e612a",
          700: "#7f4e23",
          800: "#57371b",
          900: "#382412",
          950: "#211407"
        },
        // Semantic status colours (not theme accents).
        gold: "#f5c76b",
        violet: "#b8a7ff",
        // Direction B — report paper surface.
        paper: {
          DEFAULT: "#ffffff",
          subtle: "#f7f9f8",
          line: "#dce3df"
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"]
      },
      boxShadow: {
        // Formerly a cyan glow; now a restrained elevation shadow so
        // existing `shadow-glow` usages read as quiet depth, not glow.
        glow: "0 1px 2px rgba(0, 0, 0, 0.4), 0 12px 32px rgba(0, 0, 0, 0.32)"
      }
    }
  },
  plugins: []
};

export default config;
