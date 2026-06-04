import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "Hanken Grotesk", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Archivo", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      colors: {
        gw: {
          bg: "#0b0e0f",
          surface: "#14191b",
          "surface-elevated": "#1b2225",
          border: "#232b2d",
          text: "#e6edea",
          "text-muted": "#a8b3b0",
          accent: "#2dd4bf",
          "accent-glow": "#5eead4",
          ghost: "#f0533f",
          verified: "#3fb950",
          partial: "#e3b341",
          pending: "#768d87",
        },
      },
      keyframes: {
        scanSweep: {
          "0%": { transform: "translateY(-30%)", opacity: "0" },
          "10%": { opacity: "0.9" },
          "90%": { opacity: "0.9" },
          "100%": { transform: "translateY(130%)", opacity: "0" },
        },
        riseIn: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "rise-in": "riseIn 0.5s ease-out both",
        "scan-sweep": "scanSweep 1.1s ease-in-out 0.2s both",
      },
    },
  },
  plugins: [],
};

export default config;
