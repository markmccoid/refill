import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getConsumptionRate } from "../lib/supplement-utils";
import {
  classifyDosagesWithPeople,
  loadHouseholdLedger,
  refreshForecastCacheFor,
} from "./consumption";
import {
  requireGroupAccess,
  requireMembership,
  requireSupplementAccess,
} from "./authz";
import { linkPurchaseUrl } from "./retailers";
import { bottleDoc } from "./bottles";
import { deleteSupplementSubjectLifecycle } from "./candidateProducts";
import {
  addSupplementToGroup,
  createGroupFromSupplements,
  detachSupplementFromGroup,
} from "./groups";

const nutrientsValidator = v.array(
  v.object({
    name: v.string(),
    amount: v.number(),
    unit: v.string(),
  })
);

const supplementDoc = v.object({
  _id: v.id("supplements"),
  _creationTime: v.number(),
  householdId: v.id("households"),
  name: v.string(),
  groupId: v.optional(v.id("groups")),
  brand: v.optional(v.string()),
  form: v.optional(v.string()),
  servingSize: v.optional(v.string()),
  servingSizeAmount: v.optional(v.number()),
  servingSizeUnit: v.optional(v.string()),
  nutrients: v.optional(nutrientsValidator),
  category: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  iconId: v.optional(v.string()),
  jarSize: v.number(),
  quantityAnchor: v.optional(v.number()),
  anchoredAt: v.optional(v.number()),
  remaining: v.optional(v.number()),
  price: v.optional(v.number()),
  purchaseUrl: v.optional(v.string()),
  createdAt: v.number(),
  cachedOnHand: v.optional(v.number()),
  cachedIncomingCount: v.optional(v.number()),
  cachedRatePerDay: v.optional(v.number()),
  forecastCachedAt: v.optional(v.number()),
});

const dosageDoc = v.object({
  _id: v.id("dosages"),
  _creationTime: v.number(),
  householdId: v.optional(v.id("households")),
  supplementId: v.id("supplements"),
  personId: v.id("people"),
  pillsPerWeek: v.optional(v.number()),
  pausedAt: v.optional(v.number()),
  pauseUntil: v.optional(v.number()),
  pillsPerDose: v.optional(v.number()),
  daysPerWeek: v.optional(v.number()),
});

const hydratedSupplement = v.object({
  ...supplementDoc.fields,
  consumptionRate: v.number(),
  bottles: v.array(bottleDoc),
  dosages: v.array(dosageDoc),
});

// List supplements with each one's consumption rate (pills/day) attached, so
// the client can compute on-hand live. On-hand itself is derived, not stored.
// By default skips grouped brands (they appear under groups.list / inventory).
export const list = query({
  args: {
    householdId: v.id("households"),
    includeGrouped: v.optional(v.boolean()),
  },
  returns: v.array(hydratedSupplement),
  async handler(ctx, { householdId, includeGrouped }) {
    await requireMembership(ctx, householdId);
    const ledger = await loadHouseholdLedger(ctx, householdId);
    const now = Date.now();
    const rows = includeGrouped
      ? ledger.supplements
      : ledger.supplements.filter((s) => !s.groupId);

    return rows.map((s) => {
      const classified = classifyDosagesWithPeople(
        ledger.dosagesBySupplement.get(s._id) ?? [],
        ledger.peopleById,
        now
      );
      return {
        ...s,
        consumptionRate: getConsumptionRate(classified.activeForRate, now),
        bottles: ledger.bottlesBySupplement.get(s._id) ?? [],
        dosages: classified.personActive,
      };
    });
  },
});

/** Thin list of supplement docs (no bottles/dosages) for regimen pickers. */
export const listBasic = query({
  args: { householdId: v.id("households") },
  returns: v.array(supplementDoc),
  async handler(ctx, { householdId }) {
    await requireMembership(ctx, householdId);
    return await ctx.db
      .query("supplements")
      .withIndex("by_household", (q) => q.eq("householdId", householdId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("supplements") },
  returns: v.union(supplementDoc, v.null()),
  async handler(ctx, { id }) {
    // Return null (not throw) when the doc is gone, so a page still subscribed
    // to a just-deleted supplement can unmount/redirect instead of crashing the
    // render. Membership violations still throw — that's a real access error.
    const supplement = await ctx.db.get(id);
    if (!supplement) return null;
    await requireMembership(ctx, supplement.householdId);
    return supplement;
  },
});

// Access check for actions (which have no ctx.db): throws unless the signed-in
// caller may touch this supplement. Auth propagates through ctx.runQuery.
export const assertAccess = internalQuery({
  args: { id: v.id("supplements") },
  returns: v.null(),
  async handler(ctx, { id }) {
    await requireSupplementAccess(ctx, id);
    return null;
  },
});

// Create a supplement and insert its initial bottles (ADR-0002). Each bottle is
// full at creation (remainingAtAnchor = count); a partially-used bottle can be
// corrected afterward with bottles.recount. quantityAnchor caches Σ counts.
//
// The redesigned Add flow can also group the supplement at creation time —
// either joining an existing group (it inherits the group's dosage template,
// same as groups.addMember) or starting a fresh group with this supplement as
// its first brand (ADR-0004 single-member group). The two are mutually
// exclusive; omitting both keeps the classic solo-create behavior.
export const create = mutation({
  args: {
    householdId: v.id("households"),
    name: v.string(),
    brand: v.optional(v.string()),
    form: v.optional(v.string()),
    servingSize: v.optional(v.string()),
    servingSizeAmount: v.optional(v.number()),
    servingSizeUnit: v.optional(v.string()),
    nutrients: v.optional(nutrientsValidator),
    category: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    iconId: v.optional(v.string()),
    jarSize: v.number(),
    bottles: v.array(
      v.object({
        count: v.number(),
        price: v.number(),
        purchaseUrl: v.optional(v.string()),
        purchasedAt: v.number(),
        remaining: v.optional(v.number()), // pills on hand now (defaults to full count)
      })
    ),
    // Join this existing group after creation (XOR newGroup).
    groupId: v.optional(v.id("groups")),
    // Start a new group with this supplement as its first brand (XOR groupId).
    newGroup: v.optional(
      v.object({
        name: v.string(),
        category: v.optional(v.string()),
        dosages: v.array(
          v.object({ personId: v.id("people"), pillsPerWeek: v.number() })
        ),
      })
    ),
  },
  returns: v.id("supplements"),
  async handler(ctx, args) {
    await requireMembership(ctx, args.householdId);
    if (args.groupId && args.newGroup) {
      throw new Error("Pass either groupId or newGroup, not both.");
    }
    if (args.groupId) await requireGroupAccess(ctx, args.groupId);
    const { bottles, groupId, newGroup, ...supplementFields } = args;
    const now = Date.now();

    // Appearance XOR: icon wins over photo when both are somehow sent.
    const iconId = supplementFields.iconId?.trim() || undefined;
    const imageUrl = iconId
      ? undefined
      : supplementFields.imageUrl?.trim() || undefined;

    const onHand = bottles.reduce((sum, b) => {
      const remaining =
        b.remaining !== undefined
          ? Math.max(0, Math.min(b.remaining, b.count))
          : b.count;
      return sum + remaining;
    }, 0);
    const supplementId = await ctx.db.insert("supplements", {
      ...supplementFields,
      iconId,
      imageUrl,
      quantityAnchor: onHand,
      anchoredAt: now,
      createdAt: now,
    });

    for (const b of bottles) {
      // A purchase URL feeds the retailer model (ADR-0006): match/create the
      // retailer by domain and write through the saved link.
      const url = b.purchaseUrl?.trim();
      const retailerId = url
        ? await linkPurchaseUrl(ctx, args.householdId, supplementId, url)
        : null;
      const remainingAtAnchor =
        b.remaining !== undefined
          ? Math.max(0, Math.min(b.remaining, b.count))
          : b.count;
      await ctx.db.insert("bottles", {
        householdId: args.householdId,
        supplementId,
        count: b.count,
        price: b.price,
        purchaseUrl: url || undefined,
        retailerId: retailerId ?? undefined,
        purchasedAt: b.purchasedAt,
        remainingAtAnchor,
      });
    }

    // Group AFTER the bottles exist so the attach re-anchor sees real stock.
    if (groupId) {
      // Inherits the group's dosage template (same path as groups.addMember).
      await addSupplementToGroup(ctx, groupId, supplementId);
    } else if (newGroup) {
      await createGroupFromSupplements(ctx, {
        householdId: args.householdId,
        name: newGroup.name,
        category: newGroup.category,
        supplementIds: [supplementId],
        dosages: newGroup.dosages,
      });
    } else {
      await refreshForecastCacheFor(ctx, supplementId);
    }

    return supplementId;
  },
});

// Identity-only edit. Stock and price live in the bottle ledger — use the
// bottles.* mutations for those. jarSize here is just the add-bottle default.
export const update = mutation({
  args: {
    id: v.id("supplements"),
    name: v.optional(v.string()),
    brand: v.optional(v.string()),
    form: v.optional(v.string()),
    servingSize: v.optional(v.string()),
    servingSizeAmount: v.optional(v.number()),
    servingSizeUnit: v.optional(v.string()),
    nutrients: v.optional(nutrientsValidator),
    category: v.optional(v.string()),
    jarSize: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    iconId: v.optional(v.string()),
  },
  returns: v.union(supplementDoc, v.null()),
  async handler(ctx, { id, ...updates }) {
    await requireSupplementAccess(ctx, id);
    // Appearance XOR in the UI: picking an icon clears the photo and vice
    // versa. Empty string means "clear this field".
    const patch = { ...updates };
    if (updates.iconId !== undefined) {
      const iconId = updates.iconId.trim() || undefined;
      patch.iconId = iconId;
      if (iconId) patch.imageUrl = undefined;
    }
    if (updates.imageUrl !== undefined) {
      const imageUrl = updates.imageUrl.trim() || undefined;
      patch.imageUrl = imageUrl;
      if (imageUrl) patch.iconId = undefined;
    }
    await ctx.db.patch(id, patch);
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { id: v.id("supplements") },
  returns: v.null(),
  async handler(ctx, { id }) {
    const supplement = await requireSupplementAccess(ctx, id);
    if (supplement.groupId) {
      const group = await requireGroupAccess(ctx, supplement.groupId);
      await detachSupplementFromGroup(ctx, supplement._id, group);
    }
    await deleteSupplementSubjectLifecycle(
      ctx,
      supplement.householdId,
      supplement._id
    );
    // Cascade: DSLD facts (+ stored assets) and dosages.
    const facts = await ctx.db
      .query("supplementFacts")
      .withIndex("by_supplement", (q) => q.eq("supplementId", id))
      .unique();
    if (facts) {
      if (facts.thumbnailStorageId)
        await ctx.storage.delete(facts.thumbnailStorageId);
      if (facts.pdfStorageId) await ctx.storage.delete(facts.pdfStorageId);
      await ctx.db.delete(facts._id);
    }

    const dosages = await ctx.db
      .query("dosages")
      .withIndex("by_supplement", (q) => q.eq("supplementId", id))
      .collect();
    for (const d of dosages) await ctx.db.delete(d._id);

    const bottles = await ctx.db
      .query("bottles")
      .withIndex("by_supplement", (q) => q.eq("supplementId", id))
      .collect();
    for (const b of bottles) await ctx.db.delete(b._id);

    await ctx.db.delete(id);
  },
});
