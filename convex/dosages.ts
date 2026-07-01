import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { reanchorSupplement } from "./consumption";

export const listBySupplementId = query({
  args: { supplementId: v.id("supplements") },
  async handler(ctx, { supplementId }) {
    return await ctx.db
      .query("dosages")
      .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
      .collect();
  },
});

export const listByPersonId = query({
  args: { personId: v.id("people") },
  async handler(ctx, { personId }) {
    return await ctx.db
      .query("dosages")
      .withIndex("by_person", (q) => q.eq("personId", personId))
      .collect();
  },
});

export const create = mutation({
  args: {
    supplementId: v.id("supplements"),
    personId: v.id("people"),
    pillsPerWeek: v.number(),
  },
  async handler(ctx, args) {
    // Re-anchor first: freeze on-hand at the old rate before the rate changes.
    await reanchorSupplement(ctx, args.supplementId);
    return await ctx.db.insert("dosages", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("dosages"),
    pillsPerWeek: v.number(),
  },
  async handler(ctx, { id, ...updates }) {
    const dosage = await ctx.db.get(id);
    if (!dosage) return null;
    await reanchorSupplement(ctx, dosage.supplementId);
    await ctx.db.patch(id, updates);
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { id: v.id("dosages") },
  async handler(ctx, { id }) {
    const dosage = await ctx.db.get(id);
    if (!dosage) return;
    await reanchorSupplement(ctx, dosage.supplementId);
    await ctx.db.delete(id);
  },
});
