import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        midnight: "#050813",
        ink: "#0b1020",
        panel: "#101827",
        line: "#223049",
        aurora: "#67e8f9",
        gold: "#f5c76b",
        violet: "#b8a7ff"
      },
      boxShadow: {
        glow: "0 0 34px rgba(103, 232, 249, 0.13)"
      }
    }
  },
  plugins: []
};

export default config;
