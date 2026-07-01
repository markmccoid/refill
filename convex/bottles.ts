import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { reanchorSupplement } from "./consumption";

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
  async handler(ctx, { supplementId }) {
    return await ctx.db
      .query("bottles")
      .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
      .collect();
  },
});

/**
 * Log a new (full) bottle purchase. Re-anchors first so existing bottles freeze
 * their current remaining, then appends the new bottle full at the new anchor.
 */
export const add = mutation({
  args: {
    supplementId: v.id("supplements"),
    count: v.number(),
    price: v.number(),
    purchaseUrl: v.optional(v.string()),
    purchasedAt: v.optional(v.number()),
  },
  async handler(ctx, { supplementId, count, price, purchaseUrl, purchasedAt }) {
    // Freeze existing bottles' remaining at the current rate before adding.
    await reanchorSupplement(ctx, supplementId);
    const id = await ctx.db.insert("bottles", {
      supplementId,
      count,
      price,
      purchaseUrl: purchaseUrl || undefined,
      purchasedAt: purchasedAt ?? Date.now(),
      remainingAtAnchor: count, // a fresh bottle is full at the new anchor
    });
    await syncAnchorCache(ctx, supplementId);
    return id;
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
  async handler(ctx, { id, count, price, purchaseUrl, purchasedAt }) {
    const bottle = await ctx.db.get(id);
    if (!bottle) return null;

    const structural = count !== undefined || purchasedAt !== undefined;
    if (structural) {
      await reanchorSupplement(ctx, bottle.supplementId);
    }
    // Re-read: re-anchor may have changed remainingAtAnchor.
    const current = await ctx.db.get(id);
    if (!current) return null;

    const patch: Record<string, number | string | undefined> = {};
    if (price !== undefined) patch.price = price;
    if (purchaseUrl !== undefined) patch.purchaseUrl = purchaseUrl || undefined;
    if (purchasedAt !== undefined) patch.purchasedAt = purchasedAt;
    if (count !== undefined) {
      patch.count = count;
      patch.remainingAtAnchor = Math.min(current.remainingAtAnchor, count);
    }
    await ctx.db.patch(id, patch);

    if (structural) await syncAnchorCache(ctx, bottle.supplementId);
    return await ctx.db.get(id);
  },
});

/** Remove a bottle (logged by mistake). Re-anchors the rest, then deletes. */
export const remove = mutation({
  args: { id: v.id("bottles") },
  async handler(ctx, { id }) {
    const bottle = await ctx.db.get(id);
    if (!bottle) return;
    await reanchorSupplement(ctx, bottle.supplementId);
    await ctx.db.delete(id);
    await syncAnchorCache(ctx, bottle.supplementId);
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
  async handler(ctx, { id, remaining }) {
    const bottle = await ctx.db.get(id);
    if (!bottle) return null;
    await reanchorSupplement(ctx, bottle.supplementId);
    const current = await ctx.db.get(id);
    if (!current) return null;
    await ctx.db.patch(id, {
      remainingAtAnchor: Math.max(0, Math.min(remaining, current.count)),
    });
    await syncAnchorCache(ctx, bottle.supplementId);
    return await ctx.db.get(id);
  },
});
