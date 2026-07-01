import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { householdId: v.id("households") },
  async handler(ctx, { householdId }) {
    return await ctx.db
      .query("people")
      .withIndex("by_household", (q) => q.eq("householdId", householdId))
      .collect();
  },
});

export const create = mutation({
  args: {
    householdId: v.id("households"),
    name: v.string(),
    color: v.string(),
  },
  async handler(ctx, { householdId, name, color }) {
    return await ctx.db.insert("people", {
      householdId,
      name,
      color,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("people"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  async handler(ctx, { id, ...updates }) {
    await ctx.db.patch(id, updates);
    return await ctx.db.get(id);
  },
});
