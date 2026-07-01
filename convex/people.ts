import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { reanchorSupplement } from "./consumption";
import { getDosageWeekly } from "../lib/supplement-utils";
import { requireMembership, requirePersonAccess } from "./authz";

export const list = query({
  args: { householdId: v.id("households") },
  async handler(ctx, { householdId }) {
    await requireMembership(ctx, householdId);
    // Returns everyone (active + disabled). Callers split by status; missing
    // status means active (pre-lifecycle rows).
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
    await requireMembership(ctx, householdId);
    return await ctx.db.insert("people", {
      householdId,
      name,
      color,
      status: "active",
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
    await requirePersonAccess(ctx, id);
    await ctx.db.patch(id, updates);
    return await ctx.db.get(id);
  },
});

/**
 * The supplements a person doses, with their weekly amount — used to show the
 * blast radius of a disable/delete before it happens.
 */
export const impact = query({
  args: { id: v.id("people") },
  async handler(ctx, { id }) {
    await requirePersonAccess(ctx, id);
    const dosages = await ctx.db
      .query("dosages")
      .withIndex("by_person", (q) => q.eq("personId", id))
      .collect();
    const rows = [];
    for (const d of dosages) {
      const supplement = await ctx.db.get(d.supplementId);
      if (!supplement) continue;
      rows.push({
        supplementId: d.supplementId,
        name: supplement.name,
        perWeek: getDosageWeekly(d),
      });
    }
    return rows;
  },
});

/**
 * Pause a person: freeze on-hand for every supplement they dose at the current
 * (still-including-them) rate, then flip them to disabled so future reads
 * exclude their dosages. Reanchor must run BEFORE the status flip. See ADR-0003.
 */
export const disable = mutation({
  args: { id: v.id("people") },
  async handler(ctx, { id }) {
    await requirePersonAccess(ctx, id);
    const person = await ctx.db.get(id);
    if (!person || person.status === "disabled") return;

    const dosages = await ctx.db
      .query("dosages")
      .withIndex("by_person", (q) => q.eq("personId", id))
      .collect();
    for (const d of dosages) {
      await reanchorSupplement(ctx, d.supplementId);
    }

    await ctx.db.patch(id, { status: "disabled", disabledAt: Date.now() });
  },
});

/**
 * Re-activate a paused person: freeze on-hand at the current (excluding-them)
 * rate, then flip to active so future reads count their dosages again.
 */
export const enable = mutation({
  args: { id: v.id("people") },
  async handler(ctx, { id }) {
    await requirePersonAccess(ctx, id);
    const person = await ctx.db.get(id);
    if (!person || person.status !== "disabled") return;

    const dosages = await ctx.db
      .query("dosages")
      .withIndex("by_person", (q) => q.eq("personId", id))
      .collect();
    for (const d of dosages) {
      await reanchorSupplement(ctx, d.supplementId);
    }

    await ctx.db.patch(id, { status: "active", disabledAt: undefined });
  },
});

/**
 * Permanently delete a person: reanchor each affected supplement (so elapsed
 * time is counted at the old rate), delete their dosages, then the person.
 * Supplements are household-owned and are never deleted — one that loses its
 * last taker simply drops to rate 0 (never runs out). Irreversible.
 */
export const remove = mutation({
  args: { id: v.id("people") },
  async handler(ctx, { id }) {
    await requirePersonAccess(ctx, id);
    const person = await ctx.db.get(id);
    if (!person) return;

    const dosages = await ctx.db
      .query("dosages")
      .withIndex("by_person", (q) => q.eq("personId", id))
      .collect();
    for (const d of dosages) {
      await reanchorSupplement(ctx, d.supplementId);
      await ctx.db.delete(d._id);
    }

    await ctx.db.delete(id);
  },
});
