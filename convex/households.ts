import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: { name: v.string() },
  async handler(ctx, { name }) {
    return await ctx.db.insert("households", {
      name,
      createdAt: Date.now(),
    });
  },
});

export const get = query({
  args: { id: v.id("households") },
  async handler(ctx, { id }) {
    return await ctx.db.get(id);
  },
});
