import type { Config } from "tailwindcss";

// All values live as CSS variables in app/globals.css (:root = light,
// .dark = dark) so themes switch without touching components. The
// rgb(var() / <alpha-value>) form keeps opacity modifiers (bg-primary/40)
// working. Add/change colors there, then mirror the name here.
const token = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "border": "var(--border)",
        "border-strong": "var(--border-strong)",
        "primary-dark": token("primary-dark"),
        "primary": token("primary"),
        "primary-light": token("primary-light"),
        "critical": token("critical"),
        "critical-light": token("critical-light"),
        "low": token("low"),
        "low-light": token("low-light"),
        "on-track": token("on-track"),
        "on-track-light": token("on-track-light"),
        "stocked": token("stocked"),
        "stocked-light": token("stocked-light"),
        "bg": token("bg"),
        "surface": token("surface"),
        "surface-alt": token("surface-alt"),
        "text": token("text"),
        "text-muted": token("text-muted"),
        "text-faint": token("text-faint"),
        "text-label": token("text-label"),
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
        "card": "var(--shadow-card)",
        "focus": "0 0 0 3px rgb(var(--c-primary) / 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
