import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

const rowValidator = v.object({
  name: v.string(),
  ingredientGroup: v.optional(v.string()),
  category: v.optional(v.string()),
  amount: v.optional(v.number()),
  unit: v.optional(v.string()),
  operator: v.optional(v.string()),
  dvPercent: v.optional(v.number()),
  dvFootnote: v.optional(v.string()),
  level: v.number(),
  isOther: v.boolean(),
});

// Facts for a supplement, with resolved (signed) storage URLs for the assets.
export const getBySupplementId = query({
  args: { supplementId: v.id("supplements") },
  handler: async (ctx, { supplementId }) => {
    const facts = await ctx.db
      .query("supplementFacts")
      .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
      .unique();
    if (!facts) return null;
    return {
      ...facts,
      thumbnailUrl: facts.thumbnailStorageId
        ? await ctx.storage.getUrl(facts.thumbnailStorageId)
        : null,
      pdfUrl: facts.pdfStorageId
        ? await ctx.storage.getUrl(facts.pdfStorageId)
        : null,
    };
  },
});

// Upsert the facts record for a supplement (called by the dsld.importFacts action).
export const upsert = internalMutation({
  args: {
    supplementId: v.id("supplements"),
    dsldId: v.string(),
    fullName: v.string(),
    brandName: v.optional(v.string()),
    form: v.optional(v.string()),
    servingSize: v.optional(v.string()),
    servingsPerContainer: v.optional(v.number()),
    upcSku: v.optional(v.string()),
    offMarket: v.optional(v.boolean()),
    rows: v.array(rowValidator),
    otherIngredients: v.optional(v.string()),
    raw: v.string(),
    thumbnailStorageId: v.optional(v.id("_storage")),
    pdfStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("supplementFacts")
      .withIndex("by_supplement", (q) =>
        q.eq("supplementId", args.supplementId)
      )
      .unique();

    if (existing) {
      // Replace: drop the old assets so we don't leak file storage.
      if (existing.thumbnailStorageId)
        await ctx.storage.delete(existing.thumbnailStorageId);
      if (existing.pdfStorageId)
        await ctx.storage.delete(existing.pdfStorageId);
      await ctx.db.patch(existing._id, { ...args, fetchedAt: Date.now() });
    } else {
      await ctx.db.insert("supplementFacts", { ...args, fetchedAt: Date.now() });
    }
  },
});

// Remove a supplement's facts + assets (used by the supplement-delete cascade).
export const removeForSupplement = mutation({
  args: { supplementId: v.id("supplements") },
  handler: async (ctx, { supplementId }) => {
    const facts = await ctx.db
      .query("supplementFacts")
      .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
      .unique();
    if (!facts) return;
    if (facts.thumbnailStorageId)
      await ctx.storage.delete(facts.thumbnailStorageId);
    if (facts.pdfStorageId) await ctx.storage.delete(facts.pdfStorageId);
    await ctx.db.delete(facts._id);
  },
});
