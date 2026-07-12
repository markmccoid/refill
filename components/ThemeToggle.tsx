"use client";

import { useEffect, useState } from "react";

// Theme preference: stored in localStorage under "refill-theme" and applied
// as a .dark class on <html>, which flips the CSS variables in globals.css.
// app/layout.tsx runs a matching inline script before first paint, so the
// only job here is the setting UI + reacting to changes after load.
type Theme = "light" | "system" | "dark";

const STORAGE_KEY = "refill-theme";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "system", label: "Auto" },
  { value: "dark", label: "Dark" },
];

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  // null until mounted: localStorage doesn't exist during SSR.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setTheme(
      stored === "light" || stored === "dark" ? stored : "system"
    );
  }, []);

  useEffect(() => {
    if (!theme) return;
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
    if (theme !== "system") return;
    // Follow OS theme changes live while set to Auto.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <div>
      <div className="hidden text-xs font-medium text-text-muted mb-1.5 md:block">Theme</div>
      <div className="flex rounded-lg border border-border-strong overflow-hidden">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={`flex-1 px-1 py-1.5 text-xs font-medium transition-colors ${
              theme === opt.value
                ? "bg-primary-light text-primary font-semibold"
                : "text-text-muted hover:text-text hover:bg-text/5"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
