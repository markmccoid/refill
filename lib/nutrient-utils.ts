// Per-person nutrient aggregation from DSLD supplement-facts rows.
//
// A nutrient's daily contribution = its label %DV × servings-per-day the person
// consumes. Servings/day falls out of their pills-per-week dosage and the
// pills-per-serving implied by the supplement's jar size and servings-per-
// container. Rows without %DV (many botanicals, proprietary blends) carry an
// absolute amount only and land in a separate "no DV" list.

export interface FactsRow {
  name: string;
  category?: string;
  amount?: number;
  unit?: string;
  dvPercent?: number;
  level: number;
  isOther: boolean;
}

export interface FactsLike {
  servingsPerContainer?: number;
  servingSize?: string;
  rows: FactsRow[];
}

export interface DosageLike {
  pillsPerWeek?: number;
  pillsPerDose?: number;
  daysPerWeek?: number;
}

export interface SupplementLike {
  _id: string;
  name: string;
  jarSize: number;
}

/** Canonical weekly pill count from either dosage shape. */
export function dosageWeekly(d: DosageLike): number {
  if (typeof d.pillsPerWeek === "number") return d.pillsPerWeek;
  if (typeof d.pillsPerDose === "number" && typeof d.daysPerWeek === "number") {
    return d.pillsPerDose * d.daysPerWeek;
  }
  return 0;
}

/**
 * Pills per serving from the label. Prefer servings-per-container ÷ jar size
 * (the explicit DSLD field). Fall back to parsing the leading integer out of a
 * serving-size string like "2 softgels". Default to 1 (one pill = one serving),
 * which is the common case.
 */
export function pillsPerServing(
  jarSize: number,
  facts: FactsLike
): number {
  if (
    typeof facts.servingsPerContainer === "number" &&
    facts.servingsPerContainer > 0 &&
    jarSize > 0
  ) {
    return jarSize / facts.servingsPerContainer;
  }
  if (facts.servingSize) {
    const m = facts.servingSize.match(/\d+(?:\.\d+)?/);
    if (m) {
      const n = parseFloat(m[0]);
      if (n > 0) return n;
    }
  }
  return 1;
}

export interface NutrientSource {
  supplementId: string; // for linking to /supplements/[id]
  supplementName: string;
  dvPercent: number; // this source's %DV/day contribution (0 if none)
  amount: number; // absolute amount/day
  unit?: string;
}

export interface NutrientTotal {
  key: string; // normalized name for grouping
  name: string;
  category?: string;
  dvPercent: number; // summed across sources
  amount: number; // summed (same-unit only; see caveat below)
  unit?: string;
  sources: NutrientSource[];
}

export interface NoDvNutrient {
  name: string;
  amount: number;
  unit?: string;
  source: string;
  sourceId?: string;
}

export interface PersonNutrients {
  personId: string;
  name: string;
  color: string;
  nutrients: NutrientTotal[];
  noDv: NoDvNutrient[];
  skipped: { name: string; reason: string }[];
}

/** Group key so "Vitamin D" and "Vitamin D3" total separately — exact name match. */
function nutrientKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Aggregate one supplement's facts into the per-person accumulator, scaled by
 * that person's daily servings of it.
 *
 * Note on units: absolute amounts are summed only across sources that share a
 * unit string. DSLD occasionally mixes "mg" and "mcg" for the same nutrient
 * name across products, so a mismatched unit is kept as its own row to avoid
 * silently adding 1000× off. %DV sums freely since it is unit-agnostic.
 */
export function aggregateSupplement(
  acc: {
    nutrients: Map<string, NutrientTotal>;
    noDv: NoDvNutrient[];
  },
  supplement: SupplementLike,
  facts: FactsLike,
  weeklyPills: number
): void {
  const pps = pillsPerServing(supplement.jarSize, facts);
  if (pps <= 0) return;
  const servingsPerDay = weeklyPills / 7 / pps;

  for (const row of facts.rows) {
    if (row.isOther) continue; // "Other ingredients" — not a nutrient
    if (row.level > 0) continue; // nested sub-rows; parent already carries the total
    if (row.name.trim() === "") continue;

    const amountPerDay = row.amount != null ? row.amount * servingsPerDay : 0;

    if (row.dvPercent == null || row.dvPercent <= 0) {
      // No %DV — record amount only.
      if (amountPerDay > 0) {
        acc.noDv.push({
          name: row.name,
          amount: round(amountPerDay),
          unit: row.unit,
          source: supplement.name,
          sourceId: String(supplement._id),
        });
      }
      continue;
    }

    const dvPerDay = row.dvPercent * servingsPerDay;
    const key = nutrientKey(row.name);
    const existing = acc.nutrients.get(key);

    const source: NutrientSource = {
      supplementId: String(supplement._id),
      supplementName: supplement.name,
      dvPercent: round(dvPerDay),
      amount: round(amountPerDay),
      unit: row.unit,
    };

    if (existing) {
      // Only combine absolute amounts when units agree.
      const sameUnit =
        (existing.unit ?? row.unit) === row.unit ||
        existing.unit === undefined;
      existing.dvPercent += dvPerDay;
      if (sameUnit) {
        existing.amount += amountPerDay;
        if (existing.unit == null) existing.unit = row.unit;
      }
      existing.sources.push(source);
    } else {
      acc.nutrients.set(key, {
        key,
        name: row.name,
        category: row.category,
        dvPercent: dvPerDay,
        amount: amountPerDay,
        unit: row.unit,
        sources: [source],
      });
    }
  }
}

export function finalizeNutrients(
  map: Map<string, NutrientTotal>
): NutrientTotal[] {
  return [...map.values()]
    .map((n) => ({
      ...n,
      dvPercent: round(n.dvPercent),
      amount: round(n.amount),
    }))
    .sort((a, b) => b.dvPercent - a.dvPercent);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
