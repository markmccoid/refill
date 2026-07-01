import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getConsumptionRate } from "../lib/supplement-utils";
import { getActiveDosages } from "./consumption";
import { requireMembership, requireSupplementAccess } from "./authz";

const nutrientsValidator = v.array(
  v.object({
    name: v.string(),
    amount: v.number(),
    unit: v.string(),
  })
);

// List supplements with each one's consumption rate (pills/day) attached, so
// the client can compute on-hand live. On-hand itself is derived, not stored.
export const list = query({
  args: { householdId: v.id("households") },
  async handler(ctx, { householdId }) {
    await requireMembership(ctx, householdId);
    const supplements = await ctx.db
      .query("supplements")
      .withIndex("by_household", (q) => q.eq("householdId", householdId))
      .collect();

    return await Promise.all(
      supplements.map(async (s) => {
        // Disabled people are paused — exclude their dosages from the rate.
        const dosages = await getActiveDosages(ctx, s._id);
        const bottles = await ctx.db
          .query("bottles")
          .withIndex("by_supplement", (q) => q.eq("supplementId", s._id))
          .collect();
        return {
          ...s,
          consumptionRate: getConsumptionRate(dosages),
          bottles,
        };
      })
    );
  },
});

export const get = query({
  args: { id: v.id("supplements") },
  async handler(ctx, { id }) {
    return await requireSupplementAccess(ctx, id);
  },
});

// Create a supplement and insert its initial bottles (ADR-0002). Each bottle is
// full at creation (remainingAtAnchor = count); a partially-used bottle can be
// corrected afterward with bottles.recount. quantityAnchor caches Σ counts.
export const create = mutation({
  args: {
    householdId: v.id("households"),
    name: v.string(),
    brand: v.optional(v.string()),
    form: v.optional(v.string()),
    servingSize: v.optional(v.string()),
    servingSizeAmount: v.optional(v.number()),
    servingSizeUnit: v.optional(v.string()),
    nutrients: v.optional(nutrientsValidator),
    category: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    jarSize: v.number(),
    bottles: v.array(
      v.object({
        count: v.number(),
        price: v.number(),
        purchaseUrl: v.optional(v.string()),
        purchasedAt: v.number(),
      })
    ),
  },
  async handler(ctx, args) {
    await requireMembership(ctx, args.householdId);
    const { bottles, ...supplementFields } = args;
    const now = Date.now();

    const onHand = bottles.reduce((sum, b) => sum + b.count, 0);
    const supplementId = await ctx.db.insert("supplements", {
      ...supplementFields,
      quantityAnchor: onHand,
      anchoredAt: now,
      createdAt: now,
    });

    for (const b of bottles) {
      await ctx.db.insert("bottles", {
        supplementId,
        count: b.count,
        price: b.price,
        purchaseUrl: b.purchaseUrl || undefined,
        purchasedAt: b.purchasedAt,
        remainingAtAnchor: b.count, // full at the creation anchor
      });
    }

    return supplementId;
  },
});

// Identity-only edit. Stock and price live in the bottle ledger — use the
// bottles.* mutations for those. jarSize here is just the add-bottle default.
export const update = mutation({
  args: {
    id: v.id("supplements"),
    name: v.optional(v.string()),
    brand: v.optional(v.string()),
    form: v.optional(v.string()),
    servingSize: v.optional(v.string()),
    servingSizeAmount: v.optional(v.number()),
    servingSizeUnit: v.optional(v.string()),
    nutrients: v.optional(nutrientsValidator),
    category: v.optional(v.string()),
    jarSize: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
  },
  async handler(ctx, { id, ...updates }) {
    await requireSupplementAccess(ctx, id);
    await ctx.db.patch(id, updates);
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { id: v.id("supplements") },
  async handler(ctx, { id }) {
    await requireSupplementAccess(ctx, id);
    // Cascade: DSLD facts (+ stored assets) and dosages.
    const facts = await ctx.db
      .query("supplementFacts")
      .withIndex("by_supplement", (q) => q.eq("supplementId", id))
      .unique();
    if (facts) {
      if (facts.thumbnailStorageId)
        await ctx.storage.delete(facts.thumbnailStorageId);
      if (facts.pdfStorageId) await ctx.storage.delete(facts.pdfStorageId);
      await ctx.db.delete(facts._id);
    }

    const dosages = await ctx.db
      .query("dosages")
      .withIndex("by_supplement", (q) => q.eq("supplementId", id))
      .collect();
    for (const d of dosages) await ctx.db.delete(d._id);

    const bottles = await ctx.db
      .query("bottles")
      .withIndex("by_supplement", (q) => q.eq("supplementId", id))
      .collect();
    for (const b of bottles) await ctx.db.delete(b._id);

    await ctx.db.delete(id);
  },
});
