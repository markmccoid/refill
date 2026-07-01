import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUserId, getUserHouseholdId } from "./authz";

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

/**
 * The household of the currently signed-in user (with its id), or null if the
 * user isn't signed in or hasn't been set up yet. The client uses this instead
 * of the old localStorage demo id.
 */
export const currentHousehold = query({
  args: {},
  async handler(ctx) {
    const householdId = await getUserHouseholdId(ctx);
    if (!householdId) return null;
    const household = await ctx.db.get(householdId);
    if (!household) return null;
    return { ...household, householdId };
  },
});

/**
 * Ensure the signed-in user has a household, creating an empty one + an owner
 * membership on first sign-in. Idempotent — returns the existing household id if
 * one already exists. Replaces the old localStorage demo-seed (no sample
 * supplements are created).
 */
export const ensureForCurrentUser = mutation({
  args: { name: v.optional(v.string()) },
  async handler(ctx, { name }) {
    const userId = await requireUserId(ctx);

    const existing = await ctx.db
      .query("householdMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return existing.householdId;

    const now = Date.now();
    const householdId = await ctx.db.insert("households", {
      name: name?.trim() || "My Household",
      createdAt: now,
    });
    await ctx.db.insert("householdMembers", {
      userId,
      householdId,
      role: "owner",
      createdAt: now,
    });
    return householdId;
  },
});

/** The signed-in user's id (or null) — handy for the client to gate UI. */
export const currentUserId = query({
  args: {},
  async handler(ctx) {
    return await getAuthUserId(ctx);
  },
});
