import { MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getConsumptionRate, getBottleStates } from "../lib/supplement-utils";

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

  const dosages = await ctx.db
    .query("dosages")
    .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
    .collect();
  const rate = getConsumptionRate(dosages);

  const bottles = await ctx.db
    .query("bottles")
    .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
    .collect();

  const anchoredAt = supplement.anchoredAt ?? supplement.createdAt ?? Date.now();
  const { states, onHandExact } = getBottleStates(bottles, anchoredAt, rate);

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
