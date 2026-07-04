"use client";

import Link from "next/link";
import type { PersonNutrients } from "@/lib/nutrient-utils";
import { colorValue } from "@/lib/person-colors";
import { NutrientBar } from "./NutrientBar";

function fmtAmount(amount: number, unit?: string): string {
  const rounded =
    amount >= 100 ? Math.round(amount) : Math.round(amount * 10) / 10;
  return `${rounded}${unit ? ` ${unit}` : ""}/day`;
}

/**
 * The expanded single-person view: %DV bars with expandable sources, plus the
 * "no DV established" list and skipped supplements.
 */
export function PersonDetail({ person }: { person: PersonNutrients }) {
  const hasData =
    person.nutrients.length > 0 ||
    person.noDv.length > 0 ||
    person.skipped.length > 0;

  return (
    <div className="max-w-xl space-y-6">
      {!hasData && (
        <p className="text-sm text-text-muted py-4">
          {person.name} has no supplements with label data yet.
        </p>
      )}

      {/* Nutrients with %DV */}
      {person.nutrients.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-label uppercase tracking-wide mb-2">
            Daily Value coverage
          </h3>
          <div className="card divide-y divide-black/5 px-4 py-2">
            {person.nutrients.map((n) => (
              <NutrientBar key={n.key} nutrient={n} showSources />
            ))}
          </div>
          <p className="text-[11px] text-text-faint mt-1.5">
            %DV = % Daily Value per day at this dosage. Bars scale to each
            nutrient; the tick marks 100%. This is informational, not medical
            guidance.
          </p>
        </div>
      )}

      {/* Nutrients without an established DV */}
      {person.noDv.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-label uppercase tracking-wide mb-2">
            No Daily Value established
          </h3>
          <div className="card divide-y divide-black/5 px-4 py-1">
            {person.noDv.map((n, i) => (
              <div
                key={i}
                className="flex justify-between items-baseline py-1.5 text-sm"
              >
                <span className="font-medium">
                  {n.name}
                  {n.sourceId ? (
                    <Link
                      href={`/supplements/${n.sourceId}`}
                      className="ml-2 text-text-muted text-xs hover:text-primary hover:underline"
                    >
                      {n.source} ↗
                    </Link>
                  ) : (
                    <span className="ml-2 text-text-muted text-xs">
                      {n.source}
                    </span>
                  )}
                </span>
                <span className="font-mono text-text-muted">
                  {fmtAmount(n.amount, n.unit)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-text-faint mt-1.5">
            These have no FDA Daily Value, so we can&apos;t chart a percentage —
            only the daily amount is shown.
          </p>
        </div>
      )}

      {/* Skipped supplements */}
      {person.skipped.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-label uppercase tracking-wide mb-2">
            Not counted
          </h3>
          <div className="card divide-y divide-black/5 px-4 py-1">
            {person.skipped.map((s, i) => (
              <div
                key={i}
                className="flex justify-between items-baseline py-1.5 text-sm"
              >
                <span className="text-text-muted">{s.name}</span>
                <span className="text-xs text-text-faint">{s.reason}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-text-faint mt-1.5">
            Use the &ldquo;Find details&rdquo; lookup on a supplement to pull its
            label data from DSLD.
          </p>
        </div>
      )}

      {/* Person color ref (subtle) */}
      <div className="flex items-center gap-2 pt-2">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: colorValue(person.color) }}
        />
        <span className="text-xs text-text-muted">{person.name}</span>
      </div>
    </div>
  );
}
