"use client";

import { useState } from "react";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

type Mode = "day" | "week" | "weekday";

const round2 = (n: number) =>
  Number.isInteger(n) ? n : Math.round(n * 100) / 100;

// Spread a weekly total across 7 days as evenly as possible (for the editor).
function distribute(weekly: number): number[] {
  const w = Math.round(weekly);
  const base = Math.floor(w / 7);
  const rem = w - base * 7;
  return Array.from({ length: 7 }, (_, i) => base + (i < rem ? 1 : 0));
}

/**
 * Edits a dosage as pills-per-week. Entry is per-day, per-week, or by weekday;
 * all collapse to the weekly total passed to onChange.
 */
export function DosageInput({
  value,
  onChange,
}: {
  value: number; // pills per week
  onChange: (pillsPerWeek: number) => void;
}) {
  const [mode, setMode] = useState<Mode>("day");
  const [weekdays, setWeekdays] = useState<number[]>(() => distribute(value));

  const switchMode = (m: Mode) => {
    if (m === "weekday") setWeekdays(distribute(value));
    setMode(m);
  };

  const tabClass = (m: Mode) =>
    `px-3 py-1 text-xs font-medium rounded-md transition-colors ${
      mode === m
        ? "bg-primary text-white"
        : "text-text-muted hover:text-text"
    }`;

  return (
    <div className="space-y-2">
      <div className="inline-flex gap-1 p-1 bg-surface-alt rounded-lg">
        <button type="button" onClick={() => switchMode("day")} className={tabClass("day")}>
          Per day
        </button>
        <button type="button" onClick={() => switchMode("week")} className={tabClass("week")}>
          Per week
        </button>
        <button type="button" onClick={() => switchMode("weekday")} className={tabClass("weekday")}>
          By weekday
        </button>
      </div>

      {mode === "day" && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={0.5}
            value={round2(value / 7)}
            onChange={(e) =>
              onChange(Math.max(0, (parseFloat(e.target.value) || 0) * 7))
            }
            className="w-24 px-3 py-2 border border-border-strong rounded-lg font-mono text-sm"
          />
          <span className="text-sm text-text-muted">pills per day</span>
        </div>
      )}

      {mode === "week" && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={round2(value)}
            onChange={(e) =>
              onChange(Math.max(0, parseFloat(e.target.value) || 0))
            }
            className="w-24 px-3 py-2 border border-border-strong rounded-lg font-mono text-sm"
          />
          <span className="text-sm text-text-muted">pills per week</span>
        </div>
      )}

      {mode === "weekday" && (
        <div className="flex gap-1.5">
          {weekdays.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-text-muted">{DAYS[i]}</span>
              <input
                type="number"
                min={0}
                value={d}
                onChange={(e) => {
                  const next = [...weekdays];
                  next[i] = Math.max(0, parseInt(e.target.value) || 0);
                  setWeekdays(next);
                  onChange(next.reduce((s, n) => s + n, 0));
                }}
                className="w-9 px-1 py-1.5 border border-border-strong rounded text-center font-mono text-xs"
              />
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-text-muted">
        ≈ <span className="font-mono">{round2(value)}</span>/week ·{" "}
        <span className="font-mono">{round2(value / 7)}</span>/day
      </p>
    </div>
  );
}
