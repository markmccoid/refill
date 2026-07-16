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
  pausedAt?: number;
  pauseUntil?: number;
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
export function isDosagePaused(
  d: DosageLike,
  now: number = Date.now()
): boolean {
  if (typeof d.pausedAt !== "number") return false;
  if (d.pausedAt > now) return false;
  return typeof d.pauseUntil !== "number" || d.pauseUntil > now;
}

export function getEffectiveDosageWeekly(
  d: DosageLike,
  now: number = Date.now()
): number {
  return isDosagePaused(d, now) ? 0 : getDosageWeekly(d);
}

export function getConsumptionRate(
  dosages: DosageLike[],
  now: number = Date.now()
): number {
  const perWeek = dosages.reduce(
    (sum, d) => sum + getEffectiveDosageWeekly(d, now),
    0
  );
  return perWeek / 7;
}

function getConsumptionBreakpoints(
  dosages: DosageLike[],
  from: number,
  to: number
): number[] {
  const points = new Set([from, to]);
  for (const d of dosages) {
    if (typeof d.pausedAt === "number" && d.pausedAt > from && d.pausedAt < to) {
      points.add(d.pausedAt);
    }
    if (
      typeof d.pauseUntil === "number" &&
      d.pauseUntil > from &&
      d.pauseUntil < to
    ) {
      points.add(d.pauseUntil);
    }
  }
  return [...points].sort((a, b) => a - b);
}

export function getDosageConsumptionBetween(
  dosages: DosageLike[],
  from: number,
  to: number
): number {
  if (to <= from) return 0;
  const points = getConsumptionBreakpoints(dosages, from, to);
  let consumed = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const midpoint = start + (end - start) / 2;
    consumed += ((end - start) / MS_PER_DAY) * getConsumptionRate(dosages, midpoint);
  }
  return consumed;
}

export function getGroupConsumptionBetween(
  memberDosages: (DosageLike & { personId: string })[],
  from: number,
  to: number
): number {
  if (to <= from) return 0;
  const points = getConsumptionBreakpoints(memberDosages, from, to);
  let consumed = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const midpoint = start + (end - start) / 2;
    const perPerson = new Map<string, number>();
    for (const d of memberDosages) {
      const weekly = getEffectiveDosageWeekly(d, midpoint);
      perPerson.set(d.personId, Math.max(perPerson.get(d.personId) ?? 0, weekly));
    }
    let weekly = 0;
    for (const w of perPerson.values()) weekly += w;
    consumed += ((end - start) / MS_PER_DAY) * (weekly / 7);
  }
  return consumed;
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

/** Local calendar midnight for a timestamp (available-date comparisons). */
export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * A bottle is available on its available date's local calendar day and after —
 * not only after the stored clock time (dates are often saved at local noon).
 */
export function isBottleAvailable(
  purchasedAt: number,
  now: number = Date.now()
): boolean {
  return startOfLocalDay(purchasedAt) <= startOfLocalDay(now);
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
  incomingCount: number; // pills in future-available bottles
  incomingBottles: number;
  nextIncomingAt: number | null;
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
function getBottleLedger<B extends BottleLike>(
  bottles: B[],
  anchoredAt: number,
  now: number,
  consumptionBetween: (from: number, to: number) => number
): LedgerState<B> {
  const ordered = sortBottles(bottles);
  const remainingByBottle = new Map<B, number>();
  for (const bottle of ordered) {
    remainingByBottle.set(bottle, bottle.remainingAtAnchor);
  }

  const availableQueue: B[] = [];
  const availabilityEvents: B[] = [];
  for (const bottle of ordered) {
    // Available from local midnight of the available date, not the stored clock time.
    const availableAt = startOfLocalDay(bottle.purchasedAt);
    if (availableAt <= anchoredAt) availableQueue.push(bottle);
    else if (availableAt <= now) availabilityEvents.push(bottle);
  }

  const drain = (from: number, to: number) => {
    if (to <= from) return;
    let toConsume = consumptionBetween(from, to);
    for (const bottle of availableQueue) {
      if (toConsume <= 0) break;
      const current = remainingByBottle.get(bottle) ?? 0;
      const take = Math.min(current, toConsume);
      remainingByBottle.set(bottle, Math.max(0, current - take));
      toConsume -= take;
    }
  };

  let cursor = anchoredAt;
  let eventIndex = 0;
  while (eventIndex < availabilityEvents.length) {
    const availableAt = startOfLocalDay(
      availabilityEvents[eventIndex].purchasedAt
    );
    drain(cursor, availableAt);
    cursor = availableAt;
    while (
      eventIndex < availabilityEvents.length &&
      startOfLocalDay(availabilityEvents[eventIndex].purchasedAt) ===
        availableAt
    ) {
      availableQueue.push(availabilityEvents[eventIndex]);
      eventIndex += 1;
    }
  }
  drain(cursor, now);

  const states: BottleState<B>[] = ordered.map((bottle) => {
    const remaining = Math.max(0, remainingByBottle.get(bottle) ?? 0);
    return {
      bottle,
      remaining,
      isOpen: false,
      isEmpty: remaining <= 0,
      fillPct: bottle.count > 0 ? (remaining / bottle.count) * 100 : 0,
      costPerPill: bottle.count > 0 ? bottle.price / bottle.count : 0,
    };
  });

  const open = states.find(
    (s) => isBottleAvailable(s.bottle.purchasedAt, now) && s.remaining > 0
  );
  if (open) open.isOpen = true;

  const availableStates = states.filter((s) =>
    isBottleAvailable(s.bottle.purchasedAt, now)
  );
  const incomingStates = states.filter(
    (s) => !isBottleAvailable(s.bottle.purchasedAt, now) && s.remaining > 0
  );
  const onHandExact = availableStates.reduce((sum, s) => sum + s.remaining, 0);
  const incomingCount = incomingStates.reduce((sum, s) => sum + s.remaining, 0);
  const nonEmpty = availableStates.filter((s) => s.remaining > 0);
  return {
    states,
    onHandExact,
    onHand: Math.round(onHandExact),
    incomingCount: Math.round(incomingCount),
    incomingBottles: incomingStates.length,
    nextIncomingAt:
      incomingStates.length > 0 ? incomingStates[0].bottle.purchasedAt : null,
    openCostPerPill: open ? open.costPerPill : 0,
    sealedSpares: nonEmpty.length > 0 ? nonEmpty.length - 1 : 0,
    bottleCount: nonEmpty.length,
    openFillPct: open ? open.fillPct : 0,
    openRemaining: open ? Math.round(open.remaining) : 0,
  };
}

export function getBottleStates<B extends BottleLike>(
  bottles: B[],
  anchoredAt: number,
  ratePerDay: number,
  now: number = Date.now()
): LedgerState<B> {
  return getBottleLedger(
    bottles,
    anchoredAt,
    now,
    (from, to) => ((to - from) / MS_PER_DAY) * ratePerDay
  );
}

export function getBottleStatesForDosages<B extends BottleLike>(
  bottles: B[],
  anchoredAt: number,
  dosages: DosageLike[],
  now: number = Date.now()
): LedgerState<B> {
  return getBottleLedger(bottles, anchoredAt, now, (from, to) =>
    getDosageConsumptionBetween(dosages, from, to)
  );
}

// --- Groups (ADR-0004) -------------------------------------------------------
// A Group pools interchangeable brands into ONE sequential FIFO queue. Only the
// open bottle depletes; every other brand's bottles freeze. Because group dosage
// is materialised equally onto every member (see convex/groups.ts), all members
// share one rate, so the whole group consumes at that single rate — a group is
// getBottleStates over the pooled, cross-brand bottle list, and the open bottle's
// owning supplement is the "open brand". Per-brand overrides (which would make the
// rate piecewise) are deferred; see ADR-0004.

export interface GroupMember<B extends BottleLike = BottleLike> {
  supplementId: string;
  bottles: B[];
}

export interface GroupLedgerState<B extends BottleLike = BottleLike>
  extends LedgerState<B & { supplementId: string }> {
  openSupplementId: string | null; // which brand's bottle is currently open
}

/**
 * Pool every member brand's bottles into one FIFO queue and walk it oldest-first
 * from the group's shared anchor. Identical to getBottleStates, only the queue
 * spans brands — so on-hand, the open bottle, cost-per-pill, and which brand is
 * open all fall out of the same drain.
 */
export function getGroupState<B extends BottleLike>(
  members: GroupMember<B>[],
  anchoredAt: number,
  ratePerDay: number,
  now: number = Date.now()
): GroupLedgerState<B> {
  const tagged = members.flatMap((m) =>
    m.bottles.map((b) => ({ ...b, supplementId: m.supplementId }))
  );
  const ledger = getBottleStates(tagged, anchoredAt, ratePerDay, now);
  const open = ledger.states.find((s) => s.isOpen);
  return { ...ledger, openSupplementId: open ? open.bottle.supplementId : null };
}

export function getGroupStateForDosages<B extends BottleLike>(
  members: GroupMember<B>[],
  anchoredAt: number,
  memberDosages: (DosageLike & { personId: string })[],
  now: number = Date.now()
): GroupLedgerState<B> {
  const tagged = members.flatMap((m) =>
    m.bottles.map((b) => ({ ...b, supplementId: m.supplementId }))
  );
  const ledger = getBottleLedger(tagged, anchoredAt, now, (from, to) =>
    getGroupConsumptionBetween(memberDosages, from, to)
  );
  const open = ledger.states.find((s) => s.isOpen);
  return { ...ledger, openSupplementId: open ? open.bottle.supplementId : null };
}

/**
 * A group's consumption rate. Because only one brand is open at a time and group
 * dosage is materialised equally across members, the group consumes at a SINGLE
 * member's rate — NOT the sum of members. Computed as the per-person union of
 * weekly amounts (max per person, so a member momentarily missing a dosage row
 * can't zero someone out) ÷ 7. Correct only while no per-brand override exists
 * (overrides ⇒ piecewise rate, deferred — ADR-0004).
 */
export function getGroupRate(
  memberDosages: { personId: string; weekly: number }[]
): number {
  const perPerson = new Map<string, number>();
  for (const d of memberDosages) {
    perPerson.set(d.personId, Math.max(perPerson.get(d.personId) ?? 0, d.weekly));
  }
  let weekly = 0;
  for (const w of perPerson.values()) weekly += w;
  return weekly / 7;
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
