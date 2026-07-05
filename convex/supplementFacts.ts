import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireSupplementAccess } from "./authz";

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

const sourceValidator = v.optional(
  v.union(v.literal("dsld"), v.literal("manual"))
);

// Facts for a supplement, with resolved (signed) storage URLs for the assets.
export const getBySupplementId = query({
  args: { supplementId: v.id("supplements") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("supplementFacts"),
      _creationTime: v.number(),
      supplementId: v.id("supplements"),
      source: sourceValidator,
      edited: v.optional(v.boolean()),
      dsldId: v.optional(v.string()),
      fullName: v.string(),
      brandName: v.optional(v.string()),
      form: v.optional(v.string()),
      servingSize: v.optional(v.string()),
      servingsPerContainer: v.optional(v.number()),
      upcSku: v.optional(v.string()),
      offMarket: v.optional(v.boolean()),
      rows: v.array(rowValidator),
      otherIngredients: v.optional(v.string()),
      raw: v.optional(v.string()),
      thumbnailStorageId: v.optional(v.id("_storage")),
      pdfStorageId: v.optional(v.id("_storage")),
      fetchedAt: v.number(),
      thumbnailUrl: v.union(v.string(), v.null()),
      pdfUrl: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx, { supplementId }) => {
    await requireSupplementAccess(ctx, supplementId);
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

// Upsert the facts record for a supplement (called by the dsld.importFacts
// action). A DSLD import always resets provenance to pristine "dsld" —
// re-importing over user-edited facts is the "revert/replace" path, and the
// client confirms before doing that.
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
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("supplementFacts")
      .withIndex("by_supplement", (q) =>
        q.eq("supplementId", args.supplementId)
      )
      .unique();

    const doc = {
      ...args,
      source: "dsld" as const,
      edited: false,
      fetchedAt: Date.now(),
    };
    if (existing) {
      // Replace: drop the old assets so we don't leak file storage.
      if (existing.thumbnailStorageId)
        await ctx.storage.delete(existing.thumbnailStorageId);
      if (existing.pdfStorageId)
        await ctx.storage.delete(existing.pdfStorageId);
      await ctx.db.patch(existing._id, doc);
    } else {
      await ctx.db.insert("supplementFacts", doc);
    }
  },
});

/**
 * Create or edit facts by hand. On an existing DSLD record this edits in place
 * — provenance (dsldId, raw snapshot, label assets) is preserved and `edited`
 * is set so the UI can show "DSLD #x · edited" and offer a revert. On a
 * supplement with no facts it creates a `source: "manual"` record.
 */
export const save = mutation({
  args: {
    supplementId: v.id("supplements"),
    servingSize: v.optional(v.string()),
    servingsPerContainer: v.optional(v.number()),
    otherIngredients: v.optional(v.string()),
    rows: v.array(rowValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const supplement = await requireSupplementAccess(ctx, args.supplementId);
    const existing = await ctx.db
      .query("supplementFacts")
      .withIndex("by_supplement", (q) =>
        q.eq("supplementId", args.supplementId)
      )
      .unique();

    const fields = {
      servingSize: args.servingSize,
      servingsPerContainer: args.servingsPerContainer,
      otherIngredients: args.otherIngredients,
      rows: args.rows,
    };

    if (existing) {
      const isDsld = (existing.source ?? "dsld") === "dsld" && existing.dsldId;
      await ctx.db.patch(existing._id, {
        ...fields,
        ...(isDsld ? { edited: true } : {}),
      });
    } else {
      await ctx.db.insert("supplementFacts", {
        supplementId: args.supplementId,
        source: "manual",
        fullName: supplement.name,
        brandName: supplement.brand,
        ...fields,
        fetchedAt: Date.now(),
      });
    }
  },
});

/** Remove a supplement's facts record and its stored label assets. */
export const remove = mutation({
  args: { supplementId: v.id("supplements") },
  returns: v.null(),
  handler: async (ctx, { supplementId }) => {
    await requireSupplementAccess(ctx, supplementId);
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
