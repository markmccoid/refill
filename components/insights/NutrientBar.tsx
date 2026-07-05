"use client";

import Link from "next/link";
import type { NutrientTotal } from "@/lib/nutrient-utils";

/** Format an absolute amount with its unit, e.g. 950 mg/day. */
function fmtAmount(amount: number, unit?: string): string {
  const rounded =
    amount >= 100 ? Math.round(amount) : Math.round(amount * 10) / 10;
  return `${rounded}${unit ? ` ${unit}` : ""}/day`;
}

/** Color band for a %DV level. */
function dvTier(pct: number): {
  bar: string;
  badge: string;
  label?: string;
} {
  if (pct >= 200)
    return {
      bar: "bg-critical",
      badge: "bg-critical-light text-critical",
      label: "high",
    };
  if (pct >= 100)
    return {
      bar: "bg-low",
      badge: "bg-low-light text-low",
      label: "stacking",
    };
  if (pct >= 50)
    return { bar: "bg-on-track", badge: "", label: undefined };
  return { bar: "bg-primary/40", badge: "", label: undefined };
}

export function NutrientBar({
  nutrient,
  showSources = true,
}: {
  nutrient: NutrientTotal;
  /** Render the per-supplement contribution pills. On by default. */
  showSources?: boolean;
}) {
  const tier = dvTier(nutrient.dvPercent);
  // Scale so 100% is a visible reference; values above widen the track.
  const scaleMax = Math.max(100, Math.ceil(nutrient.dvPercent / 50) * 50);
  const widthPct = Math.min(100, (nutrient.dvPercent / scaleMax) * 100);
  const atRef = (100 / scaleMax) * 100;
  const showPills = showSources && nutrient.sources.length > 0;

  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium flex items-center gap-1.5">
          {nutrient.name}
          {nutrient.category && (
            <span className="text-[10px] uppercase tracking-wide text-text-faint font-normal">
              {nutrient.category}
            </span>
          )}
        </span>
        <span className="font-mono text-sm flex items-center gap-1.5">
          <span className="font-semibold">
            {Math.round(nutrient.dvPercent)}%
          </span>
          {tier.label && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tier.badge}`}
            >
              {tier.label}
            </span>
          )}
        </span>
      </div>

      {/* Track */}
      <div className="relative h-2 mt-1 bg-text/5 rounded-full overflow-visible">
        <div
          className={`h-full rounded-full ${tier.bar}`}
          style={{ width: `${widthPct}%` }}
        />
        {/* 100% reference tick */}
        {atRef < 100 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-text/30"
            style={{ left: `${atRef}%` }}
            title="100% Daily Value"
          />
        )}
      </div>

      <div className="flex justify-between mt-0.5">
        <span className="text-[11px] text-text-muted font-mono">
          {nutrient.amount > 0 && nutrient.unit
            ? fmtAmount(nutrient.amount, nutrient.unit)
            : ""}
        </span>
      </div>

      {/* Per-supplement contribution pills */}
      {showPills && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {nutrient.sources
            .slice()
            .sort((a, b) => b.dvPercent - a.dvPercent)
            .map((src, i) => (
              <Link
                key={i}
                href={`/supplements/${src.supplementId}`}
                className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-text/5 hover:bg-primary-light text-[11px] transition-colors"
                title={`${src.supplementName}: ${Math.round(src.dvPercent)}% DV${
                  src.amount > 0 && src.unit
                    ? ` · ${fmtAmount(src.amount, src.unit)}`
                    : ""
                }`}
              >
                <span className="text-text-muted group-hover:text-primary">
                  {src.supplementName}
                </span>
                <span className="font-mono text-text-faint group-hover:text-primary">
                  {Math.round(src.dvPercent)}%
                </span>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
