import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRetailerAccess, requireSupplementAccess } from "./authz";

// Saved purchase links (ADR-0006): the product URL you'd reopen to restock a
// supplement at a retailer. One per (supplement, retailer), written through
// from the planner's offer rows so next cycle remembers it.

const linkDoc = v.object({
  _id: v.id("savedLinks"),
  _creationTime: v.number(),
  supplementId: v.id("supplements"),
  retailerId: v.id("retailers"),
  url: v.string(),
});

export const listBySupplement = query({
  args: { supplementId: v.id("supplements") },
  returns: v.array(linkDoc),
  async handler(ctx, { supplementId }) {
    await requireSupplementAccess(ctx, supplementId);
    return await ctx.db
      .query("savedLinks")
      .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
      .collect();
  },
});

/** Set (or clear, with an empty url) the link for one (supplement, retailer). */
export const upsert = mutation({
  args: {
    supplementId: v.id("supplements"),
    retailerId: v.id("retailers"),
    url: v.string(),
  },
  returns: v.null(),
  async handler(ctx, { supplementId, retailerId, url }) {
    const supplement = await requireSupplementAccess(ctx, supplementId);
    const retailer = await requireRetailerAccess(ctx, retailerId);
    if (supplement.householdId !== retailer.householdId) {
      throw new Error("Supplement and retailer belong to different households.");
    }

    const existing = await ctx.db
      .query("savedLinks")
      .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
      .collect();
    const mine = existing.find((l) => l.retailerId === retailerId);

    const trimmed = url.trim();
    if (!trimmed) {
      if (mine) await ctx.db.delete(mine._id);
      return null;
    }
    if (mine) await ctx.db.patch(mine._id, { url: trimmed });
    else await ctx.db.insert("savedLinks", { supplementId, retailerId, url: trimmed });
    return null;
  },
});
