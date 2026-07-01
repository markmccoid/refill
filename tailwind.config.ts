import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design tokens from handoff
        "border": "rgba(20, 40, 30, 0.07)",
        "primary-dark": "#1f5c41",
        "primary": "#2e7d5b",
        "primary-light": "#eaf2ec",
        "critical": "#c0492f",
        "critical-light": "#f8e8e3",
        "low": "#b07d18",
        "low-light": "#f7efda",
        "on-track": "#2e7d5b",
        "on-track-light": "#e7f1ea",
        "stocked": "#1f5c41",
        "stocked-light": "#e2ece6",
        "bg": "#f1f4f0",
        "surface": "#ffffff",
        "surface-alt": "#fbfcfb",
        "text": "#1c2620",
        "text-muted": "#5e6b63",
        "text-faint": "#8a958e",
        "text-label": "#46524b",
      },
      fontFamily: {
        sans: ['Hanken Grotesk', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      fontSize: {
        "xs": "11px",
        "sm": "12.5px",
        "base": "13px",
        "lg": "14px",
        "xl": "15px",
        "2xl": "23px",
      },
      borderRadius: {
        "xs": "8px",
        "sm": "9px",
        "md": "11px",
        "lg": "12px",
        "xl": "13px",
      },
      boxShadow: {
        "card": "0 6px 24px -10px rgba(20, 40, 30, 0.18)",
        "focus": "0 0 0 3px rgba(46, 125, 91, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
