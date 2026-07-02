import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUserId, getUserHouseholdId, requireMembership } from "./authz";

/**
 * The household of the currently signed-in user (with its id), or null if the
 * user isn't signed in or hasn't been set up yet. The client uses this instead
 * of the old localStorage demo id.
 */
export const currentHousehold = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("households"),
      _creationTime: v.number(),
      name: v.string(),
      createdAt: v.number(),
      forecastWindowDays: v.optional(v.number()),
      coverageTargetDays: v.optional(v.number()),
      householdId: v.id("households"),
    })
  ),
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
  returns: v.id("households"),
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

/**
 * Update the household's restock knobs (ADR-0006): forecast window (urgency
 * signalling) and coverage target (recommended-quantity horizon). Missing
 * fields are left unchanged; defaults (30/90) apply in code when unset.
 */
export const updateSettings = mutation({
  args: {
    householdId: v.id("households"),
    forecastWindowDays: v.optional(v.number()),
    coverageTargetDays: v.optional(v.number()),
  },
  returns: v.null(),
  async handler(ctx, { householdId, forecastWindowDays, coverageTargetDays }) {
    await requireMembership(ctx, householdId);
    const patch: Record<string, number> = {};
    if (forecastWindowDays !== undefined && forecastWindowDays > 0)
      patch.forecastWindowDays = forecastWindowDays;
    if (coverageTargetDays !== undefined && coverageTargetDays > 0)
      patch.coverageTargetDays = coverageTargetDays;
    if (Object.keys(patch).length > 0) await ctx.db.patch(householdId, patch);
  },
});

/** The signed-in user's id (or null) — handy for the client to gate UI. */
export const currentUserId = query({
  args: {},
  returns: v.union(v.id("users"), v.null()),
  async handler(ctx) {
    return await getAuthUserId(ctx);
  },
});
