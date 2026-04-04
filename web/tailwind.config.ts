import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gw: {
          bg: "#0a0f1a",
          surface: "#141c2e",
          "surface-elevated": "#1a2440",
          border: "#243049",
          text: "#e2e8f0",
          "text-muted": "#94a3b8",
          accent: "#3b82f6",
          "accent-glow": "#60a5fa",
          ghost: "#ef4444",
          verified: "#22c55e",
          partial: "#f59e0b",
          pending: "#6b7280",
        },
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        countUp: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "count-up": "countUp 1.5s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
