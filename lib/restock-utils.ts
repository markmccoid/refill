// Restock Planner constants + math (ADR-0006). Shared by Convex functions and
// the client so both sides compute identical recommendations and totals.

/** Urgency signalling only (badge, picker highlight) — never adds to the plan. */
export const DEFAULT_FORECAST_WINDOW_DAYS = 30;

/** Horizon the recommended quantity aims to cover after purchase. */
export const DEFAULT_COVERAGE_TARGET_DAYS = 90;

/**
 * Bottles to buy so that, after purchase, on hand covers the target at the
 * current rate: max(1, ceil((rate × coverageDays − onHand) / bottleCount)).
 * A suggestion — the planned quantity is always editable.
 */
export function getRecommendedQty(
  ratePerDay: number,
  onHand: number,
  bottleCount: number,
  coverageDays: number = DEFAULT_COVERAGE_TARGET_DAYS
): number {
  if (bottleCount <= 0) return 1;
  const shortfall = ratePerDay * coverageDays - onHand;
  return Math.max(1, Math.ceil(shortfall / bottleCount));
}

/**
 * Hostname of a URL, www-stripped and lowercased — the key retailers are
 * matched on. Null when the string isn't a plausible web URL.
 */
export function getUrlHost(url: string): string | null {
  try {
    const host = new URL(
      url.includes("://") ? url : `https://${url}`
    ).hostname.toLowerCase();
    const stripped = host.replace(/^www\./, "");
    return stripped.includes(".") ? stripped : null;
  } catch {
    return null;
  }
}

/** Guess a display name from a URL's domain: "www.iherb.com" → "Iherb". */
export function guessRetailerName(url: string): string {
  const host = getUrlHost(url);
  if (!host) return url;
  const core = host.split(".")[0];
  return core ? core.charAt(0).toUpperCase() + core.slice(1) : url;
}
