import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { getActiveDosages, reanchorFor } from "./consumption";
import { requireMembership } from "./authz";
import {
  getBottleStates,
  getConsumptionRate,
  getDaysLeft,
  getDosageWeekly,
  getGroupRate,
  getGroupState,
} from "../lib/supplement-utils";
import {
  DEFAULT_COVERAGE_TARGET_DAYS,
  DEFAULT_FORECAST_WINDOW_DAYS,
  getRecommendedQty,
} from "../lib/restock-utils";

// The Restock Planner backend (ADR-0006). One active plan per household,
// user-curated only; retailer orders are derived, never stored; purchases land
// as individual bottle rows through the same re-anchor path as bottles.add.

// --- Subject states ----------------------------------------------------------
// A "subject" is what runs out: a solo supplement or a whole group (never an
// individual grouped brand). Mirrors the dashboard's derivation, server-side.

interface SubjectState {
  kind: "supplement" | "group";
  supplementId: Id<"supplements"> | null;
  groupId: Id<"groups"> | null;
  name: string;
  imageUrl: string | null;
  onHand: number;
  ratePerDay: number;
  daysLeft: number | null; // null = no forecast (nobody takes it)
  brands: Doc<"supplements">[]; // solo: [itself]; group: member brands
  defaultBrand: Doc<"supplements"> | null; // solo: itself; group: open brand
}

async function getSubjectStates(
  ctx: QueryCtx | MutationCtx,
  householdId: Id<"households">
): Promise<SubjectState[]> {
  const supplements = await ctx.db
    .query("supplements")
    .withIndex("by_household", (q) => q.eq("householdId", householdId))
    .collect();
  const groups = await ctx.db
    .query("groups")
    .withIndex("by_household", (q) => q.eq("householdId", householdId))
    .collect();

  const bottlesOf = new Map<Id<"supplements">, Doc<"bottles">[]>();
  for (const s of supplements) {
    bottlesOf.set(
      s._id,
      await ctx.db
        .query("bottles")
        .withIndex("by_supplement", (q) => q.eq("supplementId", s._id))
        .collect()
    );
  }

  const now = Date.now();
  const states: SubjectState[] = [];

  for (const s of supplements.filter((s) => !s.groupId)) {
    const rate = getConsumptionRate(await getActiveDosages(ctx, s._id));
    const anchoredAt = s.anchoredAt ?? s.createdAt ?? now;
    const ledger = getBottleStates(bottlesOf.get(s._id) ?? [], anchoredAt, rate, now);
    const days = getDaysLeft(ledger.onHand, rate);
    states.push({
      kind: "supplement",
      supplementId: s._id,
      groupId: null,
      name: s.name,
      imageUrl: s.imageUrl ?? null,
      onHand: ledger.onHand,
      ratePerDay: rate,
      daysLeft: Number.isFinite(days) ? days : null,
      brands: [s],
      defaultBrand: s,
    });
  }

  for (const g of groups) {
    const members = supplements.filter((s) => s.groupId === g._id);
    const weeklies: { personId: string; weekly: number }[] = [];
    for (const m of members) {
      for (const d of await getActiveDosages(ctx, m._id)) {
        weeklies.push({ personId: d.personId, weekly: getDosageWeekly(d) });
      }
    }
    const rate = getGroupRate(weeklies);
    const ledger = getGroupState(
      members.map((m) => ({
        supplementId: m._id as string,
        bottles: bottlesOf.get(m._id) ?? [],
      })),
      g.anchoredAt,
      rate,
      now
    );
    const open =
      members.find((m) => m._id === ledger.openSupplementId) ?? members[0] ?? null;
    const days = getDaysLeft(ledger.onHand, rate);
    states.push({
      kind: "group",
      supplementId: null,
      groupId: g._id,
      name: g.name,
      imageUrl: open?.imageUrl ?? null,
      onHand: ledger.onHand,
      ratePerDay: rate,
      daysLeft: Number.isFinite(days) ? days : null,
      brands: members,
      defaultBrand: open,
    });
  }

  return states;
}

function subjectOf(
  states: SubjectState[],
  item: Doc<"restockItems">
): SubjectState | undefined {
  return states.find((s) =>
    item.groupId ? s.groupId === item.groupId : s.supplementId === item.supplementId
  );
}

async function activeItems(
  ctx: QueryCtx | MutationCtx,
  householdId: Id<"households">
): Promise<Doc<"restockItems">[]> {
  return await ctx.db
    .query("restockItems")
    .withIndex("by_household_status", (q) =>
      q.eq("householdId", householdId).eq("status", "active")
    )
    .collect();
}

function settingsOf(household: Doc<"households"> | null) {
  return {
    forecastWindowDays:
      household?.forecastWindowDays ?? DEFAULT_FORECAST_WINDOW_DAYS,
    coverageTargetDays:
      household?.coverageTargetDays ?? DEFAULT_COVERAGE_TARGET_DAYS,
  };
}

// --- Queries -----------------------------------------------------------------

/**
 * Urgency badge for the sidebar: subjects running out within the forecast
 * window that aren't on the active plan. Informs; never adds anything.
 */
export const badgeCount = query({
  args: { householdId: v.id("households") },
  returns: v.number(),
  async handler(ctx, { householdId }) {
    await requireMembership(ctx, householdId);
    const { forecastWindowDays } = settingsOf(await ctx.db.get(householdId));
    const states = await getSubjectStates(ctx, householdId);
    const items = await activeItems(ctx, householdId);
    const onPlan = new Set(
      items.map((i) => (i.groupId ?? i.supplementId) as string)
    );
    return states.filter(
      (s) =>
        s.daysLeft !== null &&
        s.daysLeft <= forecastWindowDays &&
        !onPlan.has((s.groupId ?? s.supplementId) as string)
    ).length;
  },
});

/**
 * The picker modal's list: every subject ordered by run-out (no-forecast last),
 * flagged with urgency and current plan membership. The modal is the plan's
 * only membership editor.
 */
export const picker = query({
  args: { householdId: v.id("households") },
  returns: v.object({
    forecastWindowDays: v.number(),
    subjects: v.array(
      v.object({
        kind: v.union(v.literal("supplement"), v.literal("group")),
        supplementId: v.union(v.id("supplements"), v.null()),
        groupId: v.union(v.id("groups"), v.null()),
        name: v.string(),
        onHand: v.number(),
        daysLeft: v.union(v.number(), v.null()),
        urgent: v.boolean(),
        onPlan: v.boolean(),
        hasPlanWork: v.boolean(), // entered prices or a selection would be lost
      })
    ),
  }),
  async handler(ctx, { householdId }) {
    await requireMembership(ctx, householdId);
    const { forecastWindowDays } = settingsOf(await ctx.db.get(householdId));
    const states = await getSubjectStates(ctx, householdId);
    const items = await activeItems(ctx, householdId);

    const subjects = states
      .map((s) => {
        const item = items.find((i) =>
          s.groupId ? i.groupId === s.groupId : i.supplementId === s.supplementId
        );
        return {
          kind: s.kind,
          supplementId: s.supplementId,
          groupId: s.groupId,
          name: s.name,
          onHand: s.onHand,
          daysLeft: s.daysLeft,
          urgent: s.daysLeft !== null && s.daysLeft <= forecastWindowDays,
          onPlan: item !== undefined,
          hasPlanWork:
            item !== undefined &&
            (item.enteredPrices.length > 0 || item.selectedRetailerId !== undefined),
        };
      })
      .sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity));

    return { forecastWindowDays, subjects };
  },
});

const offerValidator = v.object({
  supplementId: v.id("supplements"),
  brandName: v.string(),
  brand: v.union(v.string(), v.null()),
  jarSize: v.number(),
  retailerId: v.id("retailers"),
  retailerName: v.string(),
  url: v.union(v.string(), v.null()),
  avgPrice: v.union(v.number(), v.null()),
  enteredPrice: v.union(v.number(), v.null()),
  selected: v.boolean(),
});

/**
 * The whole plan, enriched for the page: each active item with its subject's
 * live forecast, the recommended quantity, and its offers (brand × retailer:
 * saved link, average past price from the bottle ledger, entered price,
 * selection). Retailer orders are derived client-side from this — no order
 * entity exists.
 */
export const plan = query({
  args: { householdId: v.id("households") },
  returns: v.object({
    forecastWindowDays: v.number(),
    coverageTargetDays: v.number(),
    retailers: v.array(
      v.object({
        _id: v.id("retailers"),
        _creationTime: v.number(),
        householdId: v.id("households"),
        name: v.string(),
        baseUrl: v.optional(v.string()),
        freeShippingThreshold: v.optional(v.number()),
        createdAt: v.number(),
      })
    ),
    items: v.array(
      v.object({
        _id: v.id("restockItems"),
        qty: v.number(),
        addedAt: v.number(),
        subjectKind: v.union(v.literal("supplement"), v.literal("group")),
        name: v.string(),
        imageUrl: v.union(v.string(), v.null()),
        onHand: v.number(),
        daysLeft: v.union(v.number(), v.null()),
        ratePerDay: v.number(),
        recommendedQty: v.number(),
        // The selected (or default) brand's jar size — the per-pill divisor
        // for solo items, whose offer rows don't repeat it per brand.
        defaultJarSize: v.number(),
        selectedSupplementId: v.union(v.id("supplements"), v.null()),
        selectedRetailerId: v.union(v.id("retailers"), v.null()),
        offers: v.array(offerValidator),
      })
    ),
  }),
  async handler(ctx, { householdId }) {
    await requireMembership(ctx, householdId);
    const settings = settingsOf(await ctx.db.get(householdId));
    const states = await getSubjectStates(ctx, householdId);
    const items = await activeItems(ctx, householdId);
    const retailers = await ctx.db
      .query("retailers")
      .withIndex("by_household", (q) => q.eq("householdId", householdId))
      .collect();

    const enriched = [];
    for (const item of items.sort((a, b) => a.addedAt - b.addedAt)) {
      const subject = subjectOf(states, item);
      if (!subject) continue; // subject deleted/dissolved since it was added

      // Average past price per (brand, retailer) from the bottle ledger.
      const offers = [];
      for (const brand of subject.brands) {
        const bottles = await ctx.db
          .query("bottles")
          .withIndex("by_supplement", (q) => q.eq("supplementId", brand._id))
          .collect();
        const links = await ctx.db
          .query("savedLinks")
          .withIndex("by_supplement", (q) => q.eq("supplementId", brand._id))
          .collect();
        for (const r of retailers) {
          const past = bottles.filter((b) => b.retailerId === r._id);
          const avgPrice =
            past.length > 0
              ? past.reduce((sum, b) => sum + b.price, 0) / past.length
              : null;
          const entered = item.enteredPrices.find(
            (p) => p.supplementId === brand._id && p.retailerId === r._id
          );
          offers.push({
            supplementId: brand._id,
            brandName: brand.name,
            brand: brand.brand ?? null,
            jarSize: brand.jarSize,
            retailerId: r._id,
            retailerName: r.name,
            url: links.find((l) => l.retailerId === r._id)?.url ?? null,
            avgPrice,
            enteredPrice: entered ? entered.price : null,
            selected:
              item.selectedSupplementId === brand._id &&
              item.selectedRetailerId === r._id,
          });
        }
      }

      const selectedBrand =
        subject.brands.find((b) => b._id === item.selectedSupplementId) ??
        subject.defaultBrand;
      enriched.push({
        _id: item._id,
        qty: item.qty,
        addedAt: item.addedAt,
        subjectKind: subject.kind,
        name: subject.name,
        imageUrl: subject.imageUrl,
        onHand: subject.onHand,
        daysLeft: subject.daysLeft,
        ratePerDay: subject.ratePerDay,
        recommendedQty: getRecommendedQty(
          subject.ratePerDay,
          subject.onHand,
          selectedBrand?.jarSize ?? 0,
          settings.coverageTargetDays
        ),
        defaultJarSize: selectedBrand?.jarSize ?? 0,
        selectedSupplementId: item.selectedSupplementId ?? null,
        selectedRetailerId: item.selectedRetailerId ?? null,
        offers,
      });
    }

    return { ...settings, retailers, items: enriched };
  },
});

// --- Mutations ---------------------------------------------------------------

/**
 * Reconcile plan membership to the picker's checked set — the modal is the only
 * membership editor, and doing it in one mutation makes concurrent edits safe
 * (at most one active item per subject). Removed items are deleted, prices and
 * all: session-scoped by design.
 */
export const setPlan = mutation({
  args: {
    householdId: v.id("households"),
    supplementIds: v.array(v.id("supplements")),
    groupIds: v.array(v.id("groups")),
  },
  returns: v.null(),
  async handler(ctx, { householdId, supplementIds, groupIds }) {
    await requireMembership(ctx, householdId);
    const { coverageTargetDays } = settingsOf(await ctx.db.get(householdId));
    const states = await getSubjectStates(ctx, householdId);
    const items = await activeItems(ctx, householdId);

    const wantSupp = new Set<string>(supplementIds);
    const wantGroup = new Set<string>(groupIds);

    // Remove unchecked (and orphaned) active items.
    for (const item of items) {
      const keep = item.groupId
        ? wantGroup.has(item.groupId)
        : item.supplementId
          ? wantSupp.has(item.supplementId)
          : false;
      if (!keep) await ctx.db.delete(item._id);
    }

    // Add newly checked subjects (skip ones already on the plan).
    const now = Date.now();
    for (const s of states) {
      const id = (s.groupId ?? s.supplementId) as string;
      const wanted = s.kind === "group" ? wantGroup.has(id) : wantSupp.has(id);
      if (!wanted) continue;
      const existing = items.find((i) =>
        s.groupId ? i.groupId === s.groupId : i.supplementId === s.supplementId
      );
      if (existing) continue;
      await ctx.db.insert("restockItems", {
        householdId,
        supplementId: s.supplementId ?? undefined,
        groupId: s.groupId ?? undefined,
        qty: getRecommendedQty(
          s.ratePerDay,
          s.onHand,
          s.defaultBrand?.jarSize ?? 0,
          coverageTargetDays
        ),
        enteredPrices: [],
        status: "active",
        addedAt: now,
      });
    }
    return null;
  },
});

async function requireActiveItem(
  ctx: MutationCtx,
  id: Id<"restockItems">
): Promise<Doc<"restockItems">> {
  const item = await ctx.db.get(id);
  if (!item) throw new Error("Restock item not found.");
  await requireMembership(ctx, item.householdId);
  if (item.status !== "active") throw new Error("Item is no longer active.");
  return item;
}

/** Remove one item from the plan (its session prices die with it). */
export const removeItem = mutation({
  args: { id: v.id("restockItems") },
  returns: v.null(),
  async handler(ctx, { id }) {
    const item = await ctx.db.get(id);
    if (!item) return null;
    await requireMembership(ctx, item.householdId);
    await ctx.db.delete(id);
    return null;
  },
});

/** Set the planned quantity (bottles). The recommendation is only a default. */
export const setQty = mutation({
  args: { id: v.id("restockItems"), qty: v.number() },
  returns: v.null(),
  async handler(ctx, { id, qty }) {
    const item = await requireActiveItem(ctx, id);
    await ctx.db.patch(item._id, { qty: Math.max(1, Math.round(qty)) });
    return null;
  },
});

/** Enter (or clear, with null) the sticker price for one (brand, retailer). */
export const setPrice = mutation({
  args: {
    id: v.id("restockItems"),
    supplementId: v.id("supplements"),
    retailerId: v.id("retailers"),
    price: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  async handler(ctx, { id, supplementId, retailerId, price }) {
    const item = await requireActiveItem(ctx, id);
    const rest = item.enteredPrices.filter(
      (p) => !(p.supplementId === supplementId && p.retailerId === retailerId)
    );
    if (price !== null && price >= 0) {
      rest.push({ supplementId, retailerId, price });
    }
    await ctx.db.patch(item._id, { enteredPrices: rest });
    return null;
  },
});

/**
 * Select an offer — brand + retailer in one act (Q3/Q6). Passing nulls clears
 * the selection. Totals recompute reactively; nothing else is stored.
 */
export const selectOffer = mutation({
  args: {
    id: v.id("restockItems"),
    supplementId: v.union(v.id("supplements"), v.null()),
    retailerId: v.union(v.id("retailers"), v.null()),
  },
  returns: v.null(),
  async handler(ctx, { id, supplementId, retailerId }) {
    const item = await requireActiveItem(ctx, id);
    if (supplementId === null || retailerId === null) {
      await ctx.db.patch(item._id, {
        selectedSupplementId: undefined,
        selectedRetailerId: undefined,
      });
      return null;
    }
    // The brand must be the item's subject (solo) or a member of it (group).
    const brand = await ctx.db.get(supplementId);
    if (!brand) throw new Error("Brand not found.");
    const valid = item.groupId
      ? brand.groupId === item.groupId
      : item.supplementId === supplementId;
    if (!valid) throw new Error("That brand doesn't fulfil this item.");
    const retailer = await ctx.db.get(retailerId);
    if (!retailer || retailer.householdId !== item.householdId) {
      throw new Error("Retailer not found.");
    }
    await ctx.db.patch(item._id, {
      selectedSupplementId: supplementId,
      selectedRetailerId: retailerId,
    });
    return null;
  },
});

/** Resync supplement.quantityAnchor = Σ bottle.remainingAtAnchor (cache). */
async function syncAnchorCache(
  ctx: MutationCtx,
  supplementId: Id<"supplements">
) {
  const bottles = await ctx.db
    .query("bottles")
    .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
    .collect();
  const total = bottles.reduce((sum, b) => sum + b.remainingAtAnchor, 0);
  await ctx.db.patch(supplementId, { quantityAnchor: total });
}

/**
 * Complete one retailer order (Q7). Each confirmed line lands as `qty`
 * individual bottle rows on the selected brand — full at a fresh anchor, so
 * re-anchoring and forecast refresh work exactly like bottles.add — then the
 * item leaves the plan (status "purchased", prices dying with the session).
 * Lines the user unchecked in the dialog simply aren't sent.
 */
export const markPurchased = mutation({
  args: {
    retailerId: v.id("retailers"),
    purchasedAt: v.number(),
    lines: v.array(
      v.object({
        itemId: v.id("restockItems"),
        qty: v.number(),
        pricePerBottle: v.number(),
        countPerBottle: v.number(),
      })
    ),
  },
  returns: v.null(),
  async handler(ctx, { retailerId, purchasedAt, lines }) {
    const retailer = await ctx.db.get(retailerId);
    if (!retailer) throw new Error("Retailer not found.");
    await requireMembership(ctx, retailer.householdId);

    const now = Date.now();
    for (const line of lines) {
      const item = await requireActiveItem(ctx, line.itemId);
      if (item.householdId !== retailer.householdId) {
        throw new Error("Item and retailer belong to different households.");
      }
      if (item.selectedRetailerId !== retailerId) {
        throw new Error(`"${item._id}" isn't assigned to this retailer.`);
      }
      const brandId = item.selectedSupplementId;
      if (!brandId) throw new Error("No brand selected for an item.");
      const qty = Math.max(1, Math.round(line.qty));
      const count = Math.max(1, Math.round(line.countPerBottle));
      const price = Math.max(0, line.pricePerBottle);

      const links = await ctx.db
        .query("savedLinks")
        .withIndex("by_supplement", (q) => q.eq("supplementId", brandId))
        .collect();
      const url = links.find((l) => l.retailerId === retailerId)?.url;

      // Freeze existing bottles at the current rate, then append full bottles —
      // the same sequence as bottles.add.
      await reanchorFor(ctx, brandId);
      for (let i = 0; i < qty; i++) {
        await ctx.db.insert("bottles", {
          supplementId: brandId,
          count,
          price,
          purchaseUrl: url,
          retailerId,
          purchasedAt,
          remainingAtAnchor: count,
        });
      }
      await syncAnchorCache(ctx, brandId);

      await ctx.db.patch(item._id, { status: "purchased", purchasedAt: now });
    }
    return null;
  },
});
