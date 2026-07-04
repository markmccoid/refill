"use client";

import type { PersonNutrients } from "@/lib/nutrient-utils";
import { colorValue } from "@/lib/person-colors";
import { NutrientBar } from "./NutrientBar";

/**
 * A single person's column in the Compare view: header (color dot + name) plus
 * their %DV bars sorted desc. Read-only — sources are not expandable here to
 * keep the comparison scannable; use Detail for that.
 */
export function PersonColumn({ person }: { person: PersonNutrients }) {
  const hasData = person.nutrients.length > 0 || person.noDv.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-black/10">
        <span
          className="inline-block w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: colorValue(person.color) }}
        />
        <span className="font-semibold">{person.name}</span>
        <span className="text-xs text-text-faint ml-auto">
          {person.nutrients.length} nutrient
          {person.nutrients.length === 1 ? "" : "s"}
        </span>
      </div>

      {!hasData && (
        <p className="text-sm text-text-muted py-4">
          No label data for this person&apos;s supplements yet.
        </p>
      )}

      {person.nutrients.length > 0 && (
        <div className="divide-y divide-black/5">
          {person.nutrients.map((n) => (
            <NutrientBar key={n.key} nutrient={n} />
          ))}
        </div>
      )}

      {person.skipped.length > 0 && (
        <div className="pt-2">
          <p className="text-[11px] text-text-faint">
            {person.skipped.length} not counted (no label / not open)
          </p>
        </div>
      )}
    </div>
  );
}
