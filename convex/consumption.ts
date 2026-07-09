import { MutationCtx, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
  getBottleStatesForDosages,
  getGroupStateForDosages,
  getDosageWeekly,
  isDosagePaused,
} from "../lib/supplement-utils";

/**
 * Dosages for a supplement whose person is active (not disabled). A disabled
 * person is treated as no longer taking anything, so their dosages are kept but
 * excluded from the consumption rate. person.status (missing => active) is the
 * single source of truth. See docs/adr/0003.
 */
export async function getActiveDosages(
  ctx: QueryCtx | MutationCtx,
  supplementId: Id<"supplements">
): Promise<Doc<"dosages">[]> {
  const dosages = await ctx.db
    .query("dosages")
    .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
    .collect();
  const active: Doc<"dosages">[] = [];
  for (const d of dosages) {
    const person = await ctx.db.get(d.personId);
    if (person && person.status !== "disabled" && !isDosagePaused(d)) {
      active.push(d);
    }
  }
  return active;
}

export async function getPersonActiveDosages(
  ctx: QueryCtx | MutationCtx,
  supplementId: Id<"supplements">
): Promise<Doc<"dosages">[]> {
  const dosages = await ctx.db
    .query("dosages")
    .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
    .collect();
  const active: Doc<"dosages">[] = [];
  for (const d of dosages) {
    const person = await ctx.db.get(d.personId);
    if (person && person.status !== "disabled") active.push(d);
  }
  return active;
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

  const memberBottles: { supplementId: Id<"supplements">; bottles: Doc<"bottles">[] }[] = [];
  const dosages: (Doc<"dosages"> & { personId: string })[] = [];
  const weeklies: { personId: string; weekly: number }[] = [];
  for (const m of members) {
    const bottles = await ctx.db
      .query("bottles")
      .withIndex("by_supplement", (q) => q.eq("supplementId", m._id))
      .collect();
    memberBottles.push({ supplementId: m._id, bottles });
    for (const d of await getPersonActiveDosages(ctx, m._id)) {
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
