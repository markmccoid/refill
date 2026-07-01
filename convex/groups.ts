import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  reanchorSupplement,
  reanchorGroup,
  getActiveDosages,
} from "./consumption";
import { getDosageWeekly, getGroupRate } from "../lib/supplement-utils";

/**
 * Assemble a group's client view: its member brands, each brand's bottles, the
 * pooled rate (active takers only), and the per-person group dosage for display.
 * Shared by list + getForSupplement so both stay in sync.
 */
async function buildGroupView(ctx: QueryCtx, g: Doc<"groups">) {
  const members = await ctx.db
    .query("supplements")
    .withIndex("by_group", (q) => q.eq("groupId", g._id))
    .collect();

  const memberData = await Promise.all(
    members.map(async (m) => {
      const bottles = await ctx.db
        .query("bottles")
        .withIndex("by_supplement", (q) => q.eq("supplementId", m._id))
        .collect();
      return { supplement: m, bottles };
    })
  );

  const weeklies: { personId: string; weekly: number }[] = [];
  for (const m of members) {
    for (const d of await getActiveDosages(ctx, m._id)) {
      weeklies.push({ personId: d.personId, weekly: getDosageWeekly(d) });
    }
  }

  const takerWeekly = new Map<string, number>();
  for (const { supplement } of memberData) {
    for (const d of await ctx.db
      .query("dosages")
      .withIndex("by_supplement", (q) => q.eq("supplementId", supplement._id))
      .collect()) {
      const w = getDosageWeekly(d);
      takerWeekly.set(
        d.personId,
        Math.max(takerWeekly.get(d.personId) ?? 0, w)
      );
    }
  }
  const takers = [...takerWeekly.entries()].map(([personId, pillsPerWeek]) => ({
    personId: personId as Id<"people">,
    pillsPerWeek,
  }));

  return {
    ...g,
    members: memberData,
    takers,
    consumptionRate: getGroupRate(weeklies),
  };
}

/** Member supplements of a group (the brands it pools). */
async function groupMembers(ctx: MutationCtx, groupId: Id<"groups">) {
  return await ctx.db
    .query("supplements")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();
}

/**
 * Materialise a per-person dosage set onto one member, replacing whatever it had.
 * This is how "group dosage inherited by every brand" is stored (ADR-0004, D1):
 * no dosage schema change — each member simply carries identical dosage rows, so
 * the whole group shares one rate. A future per-brand override just lets one
 * member's rows differ.
 */
async function setMemberDosages(
  ctx: MutationCtx,
  supplementId: Id<"supplements">,
  dosages: { personId: Id<"people">; pillsPerWeek: number }[]
) {
  const existing = await ctx.db
    .query("dosages")
    .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
    .collect();
  for (const d of existing) await ctx.db.delete(d._id);
  for (const d of dosages) {
    if (d.pillsPerWeek > 0) {
      await ctx.db.insert("dosages", {
        supplementId,
        personId: d.personId,
        pillsPerWeek: d.pillsPerWeek,
      });
    }
  }
}

/** Read the group's current per-person dosage from an existing member. */
async function groupDosageTemplate(
  ctx: MutationCtx,
  memberId: Id<"supplements">
) {
  const rows = await ctx.db
    .query("dosages")
    .withIndex("by_supplement", (q) => q.eq("supplementId", memberId))
    .collect();
  return rows.map((d) => ({
    personId: d.personId,
    pillsPerWeek: d.pillsPerWeek ?? 0,
  }));
}

/**
 * Create a group from ≥2 existing supplements (ADR-0004). Each member is frozen
 * solo at its current rate first, then pooled under one fresh shared anchor. The
 * confirmed group dosage is materialised onto every member; members' prior
 * per-brand dosages are DISCARDED (option B — the group starts override-free).
 */
export const create = mutation({
  args: {
    householdId: v.id("households"),
    name: v.string(),
    category: v.optional(v.string()),
    supplementIds: v.array(v.id("supplements")),
    dosages: v.array(
      v.object({ personId: v.id("people"), pillsPerWeek: v.number() })
    ),
  },
  async handler(ctx, { householdId, name, category, supplementIds, dosages }) {
    if (supplementIds.length < 2) {
      throw new Error("A group needs at least two supplements.");
    }
    // Freeze each member solo (at its own rate) up to now before pooling.
    for (const id of supplementIds) await reanchorSupplement(ctx, id);

    const now = Date.now();
    const groupId = await ctx.db.insert("groups", {
      householdId,
      name,
      category: category || undefined,
      anchoredAt: now,
      createdAt: now,
    });

    for (const id of supplementIds) {
      await ctx.db.patch(id, { groupId, anchoredAt: now });
      await setMemberDosages(ctx, id, dosages);
    }
    return groupId;
  },
});

/**
 * Link another brand into an existing group. Freezes both the group and the
 * incoming member to now, then attaches it and materialises the group's dosage
 * onto it so it inherits (no zero-rate footgun).
 */
export const addMember = mutation({
  args: { groupId: v.id("groups"), supplementId: v.id("supplements") },
  async handler(ctx, { groupId, supplementId }) {
    const group = await ctx.db.get(groupId);
    if (!group) throw new Error("Group not found.");

    await reanchorGroup(ctx, groupId);
    await reanchorSupplement(ctx, supplementId);

    const members = await groupMembers(ctx, groupId);
    const template = members[0]
      ? await groupDosageTemplate(ctx, members[0]._id)
      : [];

    const now = Date.now();
    await ctx.db.patch(supplementId, { groupId, anchoredAt: now });
    await setMemberDosages(ctx, supplementId, template);
    await ctx.db.patch(groupId, { anchoredAt: now });
  },
});

/**
 * Unlink a brand from its group. Freezes the whole group to now first (so the
 * departing member keeps its correct frozen remaining), then detaches it. If the
 * group is left with fewer than two members it auto-dissolves — the last member
 * becomes a solo supplement again and the group row is deleted (ADR-0004).
 */
export const removeMember = mutation({
  args: { supplementId: v.id("supplements") },
  async handler(ctx, { supplementId }) {
    const supplement = await ctx.db.get(supplementId);
    if (!supplement || !supplement.groupId) return;
    const groupId = supplement.groupId;

    await reanchorGroup(ctx, groupId);
    const now = Date.now();
    await ctx.db.patch(supplementId, { groupId: undefined, anchoredAt: now });

    const remaining = await groupMembers(ctx, groupId);
    if (remaining.length < 2) {
      for (const m of remaining) {
        await ctx.db.patch(m._id, { groupId: undefined, anchoredAt: now });
      }
      await ctx.db.delete(groupId);
    }
  },
});

/**
 * Set the group's dosage for one person (pills/week), materialised onto every
 * member so the group keeps a single rate. 0 removes that person as a taker.
 * Re-anchors the group first so the new rate applies only going forward.
 */
export const setDosage = mutation({
  args: {
    groupId: v.id("groups"),
    personId: v.id("people"),
    pillsPerWeek: v.number(),
  },
  async handler(ctx, { groupId, personId, pillsPerWeek }) {
    await reanchorGroup(ctx, groupId);
    const members = await groupMembers(ctx, groupId);
    for (const m of members) {
      const rows = await ctx.db
        .query("dosages")
        .withIndex("by_supplement", (q) => q.eq("supplementId", m._id))
        .collect();
      const mine = rows.find((d) => d.personId === personId);
      if (pillsPerWeek > 0) {
        if (mine) await ctx.db.patch(mine._id, { pillsPerWeek });
        else
          await ctx.db.insert("dosages", {
            supplementId: m._id,
            personId,
            pillsPerWeek,
          });
      } else if (mine) {
        await ctx.db.delete(mine._id);
      }
    }
  },
});

/** Rename a group or change its category. Identity only — no re-anchor. */
export const update = mutation({
  args: {
    id: v.id("groups"),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  async handler(ctx, { id, ...updates }) {
    await ctx.db.patch(id, updates);
    return await ctx.db.get(id);
  },
});

/**
 * Groups for a household, each with its member brands, their bottles, and the
 * pooled group rate — the ingredients the client needs to compute pooled on-hand,
 * the open brand, and the run-out forecast live (via getGroupState).
 */
export const list = query({
  args: { householdId: v.id("households") },
  async handler(ctx, { householdId }) {
    const groups = await ctx.db
      .query("groups")
      .withIndex("by_household", (q) => q.eq("householdId", householdId))
      .collect();
    return await Promise.all(groups.map((g) => buildGroupView(ctx, g)));
  },
});

/**
 * The group a supplement belongs to (with the same pooled view as list), or null
 * if it's ungrouped. Lets the supplement detail page show a member's pooled/frozen
 * state instead of an independent (wrong) per-brand depletion.
 */
export const getForSupplement = query({
  args: { supplementId: v.id("supplements") },
  async handler(ctx, { supplementId }) {
    const supplement = await ctx.db.get(supplementId);
    if (!supplement || !supplement.groupId) return null;
    const group = await ctx.db.get(supplement.groupId);
    if (!group) return null;
    return await buildGroupView(ctx, group);
  },
});
