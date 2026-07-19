import { MutationCtx, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
  getBottleStatesForDosages,
  getGroupStateForDosages,
  getConsumptionRate,
  getDosageWeekly,
  getDaysLeft,
  getGroupRate,
  isDosagePaused,
} from "../lib/supplement-utils";

const MS_PER_DAY = 86_400_000;

type DbCtx = QueryCtx | MutationCtx;

export type ClassifiedDosages = {
  all: Doc<"dosages">[];
  /** Person is active (not disabled); includes paused dosages. */
  personActive: Doc<"dosages">[];
  /** Person active and dosage not paused — drives consumption rate. */
  activeForRate: Doc<"dosages">[];
};

/** Classify dosages against a preloaded people map (single pass, no extra reads). */
export function classifyDosagesWithPeople(
  dosages: Doc<"dosages">[],
  peopleById: Map<Id<"people">, Doc<"people"> | null>,
  now: number = Date.now()
): ClassifiedDosages {
  const personActive: Doc<"dosages">[] = [];
  const activeForRate: Doc<"dosages">[] = [];
  for (const d of dosages) {
    const person = peopleById.get(d.personId);
    const isPersonActive = !!person && person.status !== "disabled";
    if (!isPersonActive) continue;
    personActive.push(d);
    if (!isDosagePaused(d, now)) activeForRate.push(d);
  }
  return { all: dosages, personActive, activeForRate };
}

/**
 * One dosages collect + people lookups. Prefer this over calling both
 * getActiveDosages and getPersonActiveDosages.
 */
export async function classifyDosagesForSupplement(
  ctx: DbCtx,
  supplementId: Id<"supplements">,
  now: number = Date.now()
): Promise<ClassifiedDosages> {
  const dosages = await ctx.db
    .query("dosages")
    .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
    .collect();
  const peopleById = new Map<Id<"people">, Doc<"people"> | null>();
  for (const d of dosages) {
    if (!peopleById.has(d.personId)) {
      peopleById.set(d.personId, await ctx.db.get(d.personId));
    }
  }
  return classifyDosagesWithPeople(dosages, peopleById, now);
}

/**
 * Dosages for a supplement whose person is active (not disabled). A disabled
 * person is treated as no longer taking anything, so their dosages are kept but
 * excluded from the consumption rate. person.status (missing => active) is the
 * single source of truth. See docs/adr/0003.
 */
export async function getActiveDosages(
  ctx: DbCtx,
  supplementId: Id<"supplements">
): Promise<Doc<"dosages">[]> {
  return (await classifyDosagesForSupplement(ctx, supplementId)).activeForRate;
}

export async function getPersonActiveDosages(
  ctx: DbCtx,
  supplementId: Id<"supplements">
): Promise<Doc<"dosages">[]> {
  return (await classifyDosagesForSupplement(ctx, supplementId)).personActive;
}

/** Household ledger loaded in a constant number of index queries when possible. */
export type HouseholdLedger = {
  supplements: Doc<"supplements">[];
  groups: Doc<"groups">[];
  bottlesBySupplement: Map<Id<"supplements">, Doc<"bottles">[]>;
  dosagesBySupplement: Map<Id<"supplements">, Doc<"dosages">[]>;
  peopleById: Map<Id<"people">, Doc<"people"> | null>;
};

async function loadBottlesForSupplements(
  ctx: DbCtx,
  householdId: Id<"households">,
  supplements: Doc<"supplements">[]
): Promise<Map<Id<"supplements">, Doc<"bottles">[]>> {
  const bottlesBySupplement = new Map<Id<"supplements">, Doc<"bottles">[]>();
  for (const s of supplements) bottlesBySupplement.set(s._id, []);

  const byHousehold = await ctx.db
    .query("bottles")
    .withIndex("by_household", (q) => q.eq("householdId", householdId))
    .collect();

  if (byHousehold.length > 0) {
    for (const b of byHousehold) {
      const list = bottlesBySupplement.get(b.supplementId);
      if (list) list.push(b);
      else bottlesBySupplement.set(b.supplementId, [b]);
    }
    return bottlesBySupplement;
  }

  // Pre-migration fallback: per-supplement index.
  for (const s of supplements) {
    bottlesBySupplement.set(
      s._id,
      await ctx.db
        .query("bottles")
        .withIndex("by_supplement", (q) => q.eq("supplementId", s._id))
        .collect()
    );
  }
  return bottlesBySupplement;
}

async function loadDosagesForSupplements(
  ctx: DbCtx,
  householdId: Id<"households">,
  supplements: Doc<"supplements">[]
): Promise<Map<Id<"supplements">, Doc<"dosages">[]>> {
  const dosagesBySupplement = new Map<Id<"supplements">, Doc<"dosages">[]>();
  for (const s of supplements) dosagesBySupplement.set(s._id, []);

  const byHousehold = await ctx.db
    .query("dosages")
    .withIndex("by_household", (q) => q.eq("householdId", householdId))
    .collect();

  if (byHousehold.length > 0) {
    for (const d of byHousehold) {
      const list = dosagesBySupplement.get(d.supplementId);
      if (list) list.push(d);
      else dosagesBySupplement.set(d.supplementId, [d]);
    }
    return dosagesBySupplement;
  }

  for (const s of supplements) {
    dosagesBySupplement.set(
      s._id,
      await ctx.db
        .query("dosages")
        .withIndex("by_supplement", (q) => q.eq("supplementId", s._id))
        .collect()
    );
  }
  return dosagesBySupplement;
}

export async function loadHouseholdLedger(
  ctx: DbCtx,
  householdId: Id<"households">
): Promise<HouseholdLedger> {
  const supplements = await ctx.db
    .query("supplements")
    .withIndex("by_household", (q) => q.eq("householdId", householdId))
    .collect();
  const groups = await ctx.db
    .query("groups")
    .withIndex("by_household", (q) => q.eq("householdId", householdId))
    .collect();
  const people = await ctx.db
    .query("people")
    .withIndex("by_household", (q) => q.eq("householdId", householdId))
    .collect();

  const peopleById = new Map<Id<"people">, Doc<"people"> | null>();
  for (const p of people) peopleById.set(p._id, p);

  const [bottlesBySupplement, dosagesBySupplement] = await Promise.all([
    loadBottlesForSupplements(ctx, householdId, supplements),
    loadDosagesForSupplements(ctx, householdId, supplements),
  ]);

  return {
    supplements,
    groups,
    bottlesBySupplement,
    dosagesBySupplement,
    peopleById,
  };
}

/**
 * Snapshot a supplement's current on-hand into its anchor and reset the anchor
 * date to now. With the bottle ledger (ADR-0002) this snapshots EACH bottle's
 * current remaining into its `remainingAtAnchor`, so FIFO cost stays correct
 * across rate changes. The supplement's `quantityAnchor` is kept as a cache
 * (= Σ remainingAtAnchor) and `anchoredAt` is reset to now.
 *
 * Call this BEFORE any change that alters the consumption rate (dosage
 * add/edit/remove) so elapsed time is counted at the old rate and the new rate
 * only applies going forward. See docs/adr/0001 and docs/adr/0002.
 */
export async function reanchorSupplement(
  ctx: MutationCtx,
  supplementId: Id<"supplements">
) {
  const supplement = await ctx.db.get(supplementId);
  if (!supplement) return;

  const dosages = await getPersonActiveDosages(ctx, supplementId);
  const bottles = await ctx.db
    .query("bottles")
    .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
    .collect();

  const anchoredAt = supplement.anchoredAt ?? supplement.createdAt ?? Date.now();
  const { states, onHandExact } = getBottleStatesForDosages(
    bottles,
    anchoredAt,
    dosages
  );

  const now = Date.now();
  for (const s of states) {
    // Only patch when it actually moved, to avoid needless writes.
    if (s.remaining !== s.bottle.remainingAtAnchor) {
      await ctx.db.patch(s.bottle._id as Id<"bottles">, {
        remainingAtAnchor: s.remaining,
      });
    }
  }

  await ctx.db.patch(supplementId, {
    quantityAnchor: onHandExact,
    anchoredAt: now,
  });
}

/**
 * Group-level re-anchor (ADR-0004). A group shares ONE clock across its member
 * brands, so this is all-or-nothing: it snapshots EVERY member bottle's current
 * remaining (drained via the pooled FIFO walk at the group's single rate), then
 * resets the group's anchoredAt to now. Member quantityAnchor/anchoredAt are also
 * refreshed as caches so they're correct the moment a brand is unlinked.
 *
 * Fires on any change to any member: bottle add/remove/recount, dosage
 * add/edit/remove, taker changes, and link/unlink. Recounting Brand B therefore
 * re-anchors Brand A too — they share one history.
 */
export async function reanchorGroup(ctx: MutationCtx, groupId: Id<"groups">) {
  const group = await ctx.db.get(groupId);
  if (!group) return;

  const members = await ctx.db
    .query("supplements")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();

  const memberBottles: {
    supplementId: Id<"supplements">;
    bottles: Doc<"bottles">[];
  }[] = [];
  const dosages: (Doc<"dosages"> & { personId: string })[] = [];
  const weeklies: { personId: string; weekly: number }[] = [];
  for (const m of members) {
    const bottles = await ctx.db
      .query("bottles")
      .withIndex("by_supplement", (q) => q.eq("supplementId", m._id))
      .collect();
    memberBottles.push({ supplementId: m._id, bottles });
    const classified = await classifyDosagesForSupplement(ctx, m._id);
    for (const d of classified.personActive) {
      dosages.push(d);
      if (!isDosagePaused(d)) {
        weeklies.push({ personId: d.personId, weekly: getDosageWeekly(d) });
      }
    }
  }

  const { states } = getGroupStateForDosages(
    memberBottles,
    group.anchoredAt,
    dosages
  );

  const now = Date.now();
  for (const s of states) {
    if (s.remaining !== s.bottle.remainingAtAnchor) {
      await ctx.db.patch(s.bottle._id as Id<"bottles">, {
        remainingAtAnchor: s.remaining,
      });
    }
  }

  // Refresh member caches (Σ their own bottles' frozen remaining) + clocks.
  for (const mb of memberBottles) {
    const total = states
      .filter((s) => s.bottle.supplementId === mb.supplementId)
      .reduce((sum, s) => sum + s.remaining, 0);
    await ctx.db.patch(mb.supplementId, { quantityAnchor: total, anchoredAt: now });
  }

  await ctx.db.patch(groupId, { anchoredAt: now });
}

/**
 * Re-anchor whatever owns this supplement's consumption: the group if it's a
 * member, otherwise the supplement alone. Every per-supplement mutation
 * (bottles.*, dosages.*) routes through here so grouping is transparent to them.
 */
export async function reanchorFor(
  ctx: MutationCtx,
  supplementId: Id<"supplements">
) {
  const supplement = await ctx.db.get(supplementId);
  if (!supplement) return;
  if (supplement.groupId) await reanchorGroup(ctx, supplement.groupId);
  else await reanchorSupplement(ctx, supplementId);
}

// --- Forecast cache (cheap restock.badgeCount) --------------------------------

export type ForecastCacheFields = {
  cachedOnHand: number;
  cachedIncomingCount: number;
  cachedRatePerDay: number;
  forecastCachedAt: number;
};

/** Extrapolate on-hand from a forecast cache snapshot. */
export function extrapolateOnHand(
  cachedOnHand: number,
  cachedRatePerDay: number,
  forecastCachedAt: number,
  now: number = Date.now()
): number {
  const elapsedDays = Math.max(0, (now - forecastCachedAt) / MS_PER_DAY);
  return Math.max(0, cachedOnHand - cachedRatePerDay * elapsedDays);
}

export function daysLeftFromCache(
  cache: Pick<
    ForecastCacheFields,
    "cachedOnHand" | "cachedRatePerDay" | "forecastCachedAt"
  >,
  now: number = Date.now()
): number | null {
  // Match getSubjectStates: days-left uses available on-hand only (not incoming).
  const onHand = extrapolateOnHand(
    cache.cachedOnHand,
    cache.cachedRatePerDay,
    cache.forecastCachedAt,
    now
  );
  const days = getDaysLeft(onHand, cache.cachedRatePerDay);
  return Number.isFinite(days) ? days : null;
}

export async function refreshForecastCacheForSupplement(
  ctx: MutationCtx,
  supplementId: Id<"supplements">,
  now: number = Date.now()
) {
  const supplement = await ctx.db.get(supplementId);
  if (!supplement) return;
  if (supplement.groupId) {
    await refreshForecastCacheForGroup(ctx, supplement.groupId, now);
    return;
  }

  const classified = await classifyDosagesForSupplement(ctx, supplementId, now);
  const bottles = await ctx.db
    .query("bottles")
    .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
    .collect();
  const rate = getConsumptionRate(classified.activeForRate, now);
  const anchoredAt = supplement.anchoredAt ?? supplement.createdAt ?? now;
  const ledger = getBottleStatesForDosages(
    bottles,
    anchoredAt,
    classified.personActive,
    now
  );

  await ctx.db.patch(supplementId, {
    cachedOnHand: ledger.onHand,
    cachedIncomingCount: ledger.incomingCount,
    cachedRatePerDay: rate,
    forecastCachedAt: now,
  } satisfies ForecastCacheFields);
}

export async function refreshForecastCacheForGroup(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  now: number = Date.now()
) {
  const group = await ctx.db.get(groupId);
  if (!group) return;

  const members = await ctx.db
    .query("supplements")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();

  const memberBottles: {
    supplementId: string;
    bottles: Doc<"bottles">[];
  }[] = [];
  const dosages: Doc<"dosages">[] = [];
  const weeklies: { personId: string; weekly: number }[] = [];

  for (const m of members) {
    const bottles = await ctx.db
      .query("bottles")
      .withIndex("by_supplement", (q) => q.eq("supplementId", m._id))
      .collect();
    memberBottles.push({ supplementId: m._id, bottles });
    const classified = await classifyDosagesForSupplement(ctx, m._id, now);
    dosages.push(...classified.personActive);
    for (const d of classified.activeForRate) {
      weeklies.push({ personId: d.personId, weekly: getDosageWeekly(d) });
    }
  }

  const rate = getGroupRate(weeklies);
  const ledger = getGroupStateForDosages(
    memberBottles,
    group.anchoredAt,
    dosages,
    now
  );

  await ctx.db.patch(groupId, {
    cachedOnHand: ledger.onHand,
    cachedIncomingCount: ledger.incomingCount,
    cachedRatePerDay: rate,
    forecastCachedAt: now,
  } satisfies ForecastCacheFields);
}

/** Refresh the forecast cache for whatever subject owns this supplement. */
export async function refreshForecastCacheFor(
  ctx: MutationCtx,
  supplementId: Id<"supplements">,
  now: number = Date.now()
) {
  await refreshForecastCacheForSupplement(ctx, supplementId, now);
}

/** Refresh forecast caches for every subject in a household (cron / migration). */
export async function refreshForecastCachesForHousehold(
  ctx: MutationCtx,
  householdId: Id<"households">,
  now: number = Date.now()
) {
  const supplements = await ctx.db
    .query("supplements")
    .withIndex("by_household", (q) => q.eq("householdId", householdId))
    .collect();
  const groups = await ctx.db
    .query("groups")
    .withIndex("by_household", (q) => q.eq("householdId", householdId))
    .collect();

  for (const g of groups) {
    await refreshForecastCacheForGroup(ctx, g._id, now);
  }
  for (const s of supplements.filter((x) => !x.groupId)) {
    await refreshForecastCacheForSupplement(ctx, s._id, now);
  }
}
