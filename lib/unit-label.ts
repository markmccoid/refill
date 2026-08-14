/**
 * Display unit for inventory/dosage copy. Discrete forms stay "pill";
 * powders, liquids, and anything else use "serving". Blank form defaults
 * to pill. Internal fields (pillsPerWeek, costPerPill) stay unchanged.
 *
 * Match is a substring so DSLD LanguaL values like "Capsule, gelatin coated"
 * and "Tablet, chewable" still count as pills.
 */
const PILL_FORM =
  /capsule|tablet|soft\s*gel|caplet|gummy|lozenge|pill|chewable|count|piece/i;

export type UnitLabel = {
  singular: "pill" | "serving";
  plural: "pills" | "servings";
};

export function usesPillUnit(form?: string | null): boolean {
  return !form?.trim() || PILL_FORM.test(form);
}

export function unitLabel(form?: string | null): UnitLabel {
  return usesPillUnit(form)
    ? { singular: "pill", plural: "pills" }
    : { singular: "serving", plural: "servings" };
}

/** Singular or plural unit word for a displayed count. 0 uses the plural. */
export function unitWord(count: number, form?: string | null): string {
  const { singular, plural } = unitLabel(form);
  return Math.abs(count) === 1 ? singular : plural;
}

export function remainingNowLabel(form?: string | null): string {
  const { plural } = unitLabel(form);
  return `${plural.charAt(0).toUpperCase()}${plural.slice(1)} remaining now`;
}
