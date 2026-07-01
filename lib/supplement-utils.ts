export type SupplementStatus = "critical" | "low" | "on-track" | "stocked";

const MS_PER_DAY = 86_400_000;

// --- Consumption model -------------------------------------------------------
// Pill counts are not stored as a live number; they're computed from an
// "anchor" (total on hand at a moment) minus consumption since that moment.
// See docs/adr/0001-computed-consumption-from-anchor.md and CONTEXT.md.

// Minimal shapes so these helpers work with Convex docs and form state alike.
export interface ConsumptionInput {
  quantityAnchor?: number;
  anchoredAt?: number;
  // Legacy fallbacks for rows created before the consumption model:
  remaining?: number;
  createdAt?: number;
  jarSize: number;
}

export interface DosageLike {
  pillsPerWeek?: number;
  // Legacy fallback:
  pillsPerDose?: number;
  daysPerWeek?: number;
}

export function getDosageWeekly(d: DosageLike): number {
  if (typeof d.pillsPerWeek === "number") return d.pillsPerWeek;
  if (typeof d.pillsPerDose === "number" && typeof d.daysPerWeek === "number") {
    return d.pillsPerDose * d.daysPerWeek;
  }
  return 0;
}

/** Pills consumed per day = (Σ pills-per-week across takers) ÷ 7. */
export function getConsumptionRate(dosages: DosageLike[]): number {
  const perWeek = dosages.reduce((sum, d) => sum + getDosageWeekly(d), 0);
  return perWeek / 7;
}

export function getAnchorQuantity(s: ConsumptionInput): number {
  return s.quantityAnchor ?? s.remaining ?? 0;
}

export function getAnchorDate(s: ConsumptionInput): number {
  return s.anchoredAt ?? s.createdAt ?? Date.now();
}

/** Current total pills on hand, depleted by elapsed time. Floored at 0. */
export function getOnHand(
  s: ConsumptionInput,
  ratePerDay: number,
  now: number = Date.now()
): number {
  const anchor = getAnchorQuantity(s);
  const elapsedDays = Math.max(0, (now - getAnchorDate(s)) / MS_PER_DAY);
  return Math.max(0, anchor - ratePerDay * elapsedDays);
}

export interface BottleBreakdown {
  onHand: number; // whole pills, for display
  bottleCount: number; // total bottles (open + sealed)
  sealedSpares: number; // unopened full bottles
  openRemaining: number; // pills in the open bottle
  openFillPct: number; // 0..100 fill of the open bottle
}

// --- Bottle ledger (FIFO) ----------------------------------------------------
// The authoritative model (ADR-0002): a supplement owns priced bottle records,
// each holding remainingAtAnchor pills at the shared anchoredAt. Consumption
// since the anchor drains bottles oldest-first, so on-hand, the open bottle, and
// cost-per-pill all fall out of one FIFO walk.

export interface BottleLike {
  count: number;
  price: number;
  purchasedAt: number;
  remainingAtAnchor: number;
}

export interface BottleState<B extends BottleLike = BottleLike> {
  bottle: B;
  remaining: number; // pills left in this bottle now
  isOpen: boolean; // the oldest non-empty bottle (currently in use)
  isEmpty: boolean;
  fillPct: number; // 0..100
  costPerPill: number; // price / count
}

export interface LedgerState<B extends BottleLike = BottleLike> {
  states: BottleState<B>[]; // oldest -> newest
  onHand: number; // Σ remaining (rounded for display by caller)
  onHandExact: number;
  openCostPerPill: number; // cost/pill of the open bottle; 0 if none
  sealedSpares: number; // full bottles behind the open one
  bottleCount: number; // non-empty bottles (open + sealed)
  openFillPct: number; // fill of the open bottle
  openRemaining: number; // pills in the open bottle
}

/** Order bottles oldest-first (FIFO): by purchasedAt, then insertion order. */
export function sortBottles<B extends BottleLike>(bottles: B[]): B[] {
  return [...bottles].sort((a, b) => a.purchasedAt - b.purchasedAt);
}

/**
 * Walk the bottle ledger oldest-first, draining `ratePerDay × daysSinceAnchor`
 * pills from the oldest bottles. Yields each bottle's current remaining plus the
 * open bottle (oldest non-empty) whose price drives cost-per-pill.
 */
export function getBottleStates<B extends BottleLike>(
  bottles: B[],
  anchoredAt: number,
  ratePerDay: number,
  now: number = Date.now()
): LedgerState<B> {
  const ordered = sortBottles(bottles);
  const elapsedDays = Math.max(0, (now - anchoredAt) / MS_PER_DAY);
  let toConsume = Math.max(0, ratePerDay * elapsedDays);

  const states: BottleState<B>[] = ordered.map((bottle) => {
    const take = Math.min(bottle.remainingAtAnchor, toConsume);
    toConsume -= take;
    const remaining = Math.max(0, bottle.remainingAtAnchor - take);
    return {
      bottle,
      remaining,
      isOpen: false,
      isEmpty: remaining <= 0,
      fillPct: bottle.count > 0 ? (remaining / bottle.count) * 100 : 0,
      costPerPill: bottle.count > 0 ? bottle.price / bottle.count : 0,
    };
  });

  const open = states.find((s) => s.remaining > 0);
  if (open) open.isOpen = true;

  const onHandExact = states.reduce((sum, s) => sum + s.remaining, 0);
  const nonEmpty = states.filter((s) => s.remaining > 0);
  return {
    states,
    onHandExact,
    onHand: Math.round(onHandExact),
    openCostPerPill: open ? open.costPerPill : 0,
    sealedSpares: nonEmpty.length > 0 ? nonEmpty.length - 1 : 0,
    bottleCount: nonEmpty.length,
    openFillPct: open ? open.fillPct : 0,
    openRemaining: open ? Math.round(open.remaining) : 0,
  };
}

/** Cost of consumption per day = pills/day × open bottle's cost/pill. */
export function getSpendRatePerDay(
  ratePerDay: number,
  costPerPill: number
): number {
  return ratePerDay * costPerPill;
}

/** Money ever paid for a supplement = sum of every logged bottle's price. */
export function getLifetimeSpent(bottles: { price: number }[]): number {
  return bottles.reduce((sum, b) => sum + b.price, 0);
}

/**
 * Derive the open + sealed breakdown from a total, filling the open bottle
 * last: sealedSpares = ceil(onHand / jarSize) - 1. Auto-roll falls out of this.
 *
 * @deprecated Superseded by the bottle ledger (getBottleStates). Retained only
 * for the one-time backfill of pre-ledger supplements. See ADR-0002.
 */
export function getBottleBreakdown(
  onHandExact: number,
  jarSize: number
): BottleBreakdown {
  const onHand = Math.round(onHandExact);
  if (jarSize <= 0 || onHand <= 0) {
    return {
      onHand: Math.max(0, onHand),
      bottleCount: onHand > 0 ? 1 : 0,
      sealedSpares: 0,
      openRemaining: Math.max(0, onHand),
      openFillPct: jarSize > 0 ? (Math.max(0, onHand) / jarSize) * 100 : 0,
    };
  }
  const bottleCount = Math.ceil(onHand / jarSize);
  const sealedSpares = bottleCount - 1;
  const openRemaining = onHand - sealedSpares * jarSize;
  return {
    onHand,
    bottleCount,
    sealedSpares,
    openRemaining,
    openFillPct: (openRemaining / jarSize) * 100,
  };
}

/** Days until on hand reaches 0 at the given rate. Infinity if nobody takes it. */
export function getDaysLeft(onHand: number, ratePerDay: number): number {
  if (ratePerDay <= 0) return Infinity;
  return Math.ceil(onHand / ratePerDay);
}

export function getSupplementStatus(daysLeft: number): SupplementStatus {
  if (daysLeft <= 7) return "critical";
  if (daysLeft <= 25) return "low";
  if (daysLeft <= 60) return "on-track";
  return "stocked";
}

export function getTimelineBarPct(daysLeft: number): number {
  return Math.max(7, Math.min(100, (daysLeft / 160) * 100));
}

export function getRunOutDate(daysLeft: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysLeft);
  return date;
}
