import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { reanchorFor, refreshForecastCacheFor } from "./consumption";
import { requireSupplementAccess } from "./authz";
import { linkPurchaseUrl } from "./retailers";

export const bottleDoc = v.object({
  _id: v.id("bottles"),
  _creationTime: v.number(),
  householdId: v.optional(v.id("households")),
  supplementId: v.id("supplements"),
  count: v.number(),
  price: v.number(),
  purchaseUrl: v.optional(v.string()),
  retailerId: v.optional(v.id("retailers")),
  purchasedAt: v.number(),
  remainingAtAnchor: v.number(),
});

/** Resync the supplement's quantityAnchor cache = Σ bottle.remainingAtAnchor. */
async function syncAnchorCache(
  ctx: MutationCtx,
  supplementId: Id<"supplements">
) {
  const bottles = await ctx.db
    .query("bottles")
    .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
    .collect();
  const total = bottles.reduce((sum, b) => sum + b.remainingAtAnchor, 0);
  await ctx.db.patch(supplementId, { quantityAnchor: total });
}

export const listBySupplement = query({
  args: { supplementId: v.id("supplements") },
  returns: v.array(bottleDoc),
  async handler(ctx, { supplementId }) {
    await requireSupplementAccess(ctx, supplementId);
    return await ctx.db
      .query("bottles")
      .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
      .collect();
  },
});

/**
 * Log a new (full) bottle purchase. Re-anchors first so existing bottles freeze
 * their current remaining, then appends the new bottle full at the new anchor.
 * `qty` logs that many identical bottles (multi-bottle orders) in one pass.
 */
export const add = mutation({
  args: {
    supplementId: v.id("supplements"),
    count: v.number(),
    price: v.number(),
    purchaseUrl: v.optional(v.string()),
    purchasedAt: v.optional(v.number()),
    remaining: v.optional(v.number()), // pills on hand now (defaults to full count)
    qty: v.optional(v.number()), // identical bottles to insert (default 1)
  },
  returns: v.id("bottles"),
  async handler(
    ctx,
    { supplementId, count, price, purchaseUrl, purchasedAt, remaining, qty }
  ) {
    const supplement = await requireSupplementAccess(ctx, supplementId);
    // A purchase URL feeds the retailer model (ADR-0006): match/create the
    // retailer by domain and write through the saved link.
    const url = purchaseUrl?.trim();
    const retailerId = url
      ? await linkPurchaseUrl(ctx, supplement.householdId, supplementId, url)
      : null;
    // Freeze existing bottles' remaining at the current rate before adding.
    await reanchorFor(ctx, supplementId);
    const n = Math.max(1, Math.min(99, Math.round(qty ?? 1)));
    const remainingAtAnchor =
      remaining !== undefined
        ? Math.max(0, Math.min(remaining, count))
        : count;
    let id: Id<"bottles"> | null = null;
    for (let i = 0; i < n; i++) {
      id = await ctx.db.insert("bottles", {
        householdId: supplement.householdId,
        supplementId,
        count,
        price,
        purchaseUrl: url || undefined,
        retailerId: retailerId ?? undefined,
        purchasedAt: purchasedAt ?? Date.now(),
        remainingAtAnchor,
      });
    }
    await syncAnchorCache(ctx, supplementId);
    await refreshForecastCacheFor(ctx, supplementId);
    return id!;
  },
});

/**
 * Edit a bottle. Price-only edits patch in place (no count change). Changing the
 * count or purchase date is a structural change → re-anchor first so remaining
 * is frozen, then apply and clamp remaining to the new capacity.
 */
export const update = mutation({
  args: {
    id: v.id("bottles"),
    count: v.optional(v.number()),
    price: v.optional(v.number()),
    purchaseUrl: v.optional(v.string()),
    purchasedAt: v.optional(v.number()),
  },
  returns: v.union(bottleDoc, v.null()),
  async handler(ctx, { id, count, price, purchaseUrl, purchasedAt }) {
    const bottle = await ctx.db.get(id);
    if (!bottle) return null;
    const supplement = await requireSupplementAccess(ctx, bottle.supplementId);

    const structural = count !== undefined || purchasedAt !== undefined;
    if (structural) {
      await reanchorFor(ctx, bottle.supplementId);
    }
    // Re-read: re-anchor may have changed remainingAtAnchor.
    const current = await ctx.db.get(id);
    if (!current) return null;

    const patch: Record<string, number | string | undefined> = {};
    if (price !== undefined) patch.price = price;
    if (purchaseUrl !== undefined) {
      const url = purchaseUrl.trim();
      patch.purchaseUrl = url || undefined;
      // Keep the retailer in step with the URL: re-match on change, clear on
      // clear (the URL is where the retailer knowledge came from).
      patch.retailerId = url
        ? ((await linkPurchaseUrl(
            ctx,
            supplement.householdId,
            bottle.supplementId,
            url
          )) ?? undefined)
        : undefined;
    }
    if (purchasedAt !== undefined) patch.purchasedAt = purchasedAt;
    if (count !== undefined) {
      patch.count = count;
      patch.remainingAtAnchor = Math.min(current.remainingAtAnchor, count);
    }
    await ctx.db.patch(id, patch);

    if (structural) await syncAnchorCache(ctx, bottle.supplementId);
    await refreshForecastCacheFor(ctx, bottle.supplementId);
    return await ctx.db.get(id);
  },
});

/** Remove a bottle (logged by mistake). Re-anchors the rest, then deletes. */
export const remove = mutation({
  args: { id: v.id("bottles") },
  returns: v.null(),
  async handler(ctx, { id }) {
    const bottle = await ctx.db.get(id);
    if (!bottle) return;
    await requireSupplementAccess(ctx, bottle.supplementId);
    await reanchorFor(ctx, bottle.supplementId);
    await ctx.db.delete(id);
    await syncAnchorCache(ctx, bottle.supplementId);
    await refreshForecastCacheFor(ctx, bottle.supplementId);
  },
});

/**
 * Correct a bottle's actual pill count ("I recounted — it has 43"). Re-anchors
 * so the new number applies from now, then sets this bottle's remaining.
 */
export const recount = mutation({
  args: {
    id: v.id("bottles"),
    remaining: v.number(),
  },
  returns: v.union(bottleDoc, v.null()),
  async handler(ctx, { id, remaining }) {
    const bottle = await ctx.db.get(id);
    if (!bottle) return null;
    await requireSupplementAccess(ctx, bottle.supplementId);
    await reanchorFor(ctx, bottle.supplementId);
    const current = await ctx.db.get(id);
    if (!current) return null;
    await ctx.db.patch(id, {
      remainingAtAnchor: Math.max(0, Math.min(remaining, current.count)),
    });
    await syncAnchorCache(ctx, bottle.supplementId);
    await refreshForecastCacheFor(ctx, bottle.supplementId);
    return await ctx.db.get(id);
  },
});
