import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { getActiveDosages, getPersonActiveDosages, reanchorFor } from "./consumption";
import { requireMembership, requireSupplementAccess } from "./authz";
import {
  addSupplementToGroup,
  createGroupFromSupplements,
  groupDosageTemplate,
  groupMembers,
} from "./groups";
import { upsertSavedLink } from "./retailers";
import { assertExistingDestinationAllowed } from "../lib/purchase-destination-utils";
import {
  getBottleStatesForDosages,
  getConsumptionRate,
  getDaysLeft,
  getDosageWeekly,
  getGroupRate,
  getGroupStateForDosages,
} from "../lib/supplement-utils";
import {
  DEFAULT_COVERAGE_TARGET_DAYS,
  DEFAULT_FORECAST_WINDOW_DAYS,
  getRecommendedQty,
} from "../lib/restock-utils";
import {
  buildBasketLines,
  cheapestBasketRetailerIds,
  computeRetailerBasket,
  lowestPerPillCandidateIds,
} from "../lib/restock-basket-math";

// The Restock Planner backend (ADR-0006 / ADR-0009). One active plan per
// household, user-curated only; retailer baskets are derived server-side from
// selected candidates — never stored; purchases land as individual bottle rows.

// Legacy offer fields may still exist on documents until migration clears them.

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
  incomingCount: number;
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
    const dosages = await getPersonActiveDosages(ctx, s._id);
    const rate = getConsumptionRate(dosages, now);
    const anchoredAt = s.anchoredAt ?? s.createdAt ?? now;
    const ledger = getBottleStatesForDosages(
      bottlesOf.get(s._id) ?? [],
      anchoredAt,
      dosages,
      now
    );
    const days = getDaysLeft(ledger.onHand, rate);
    states.push({
      kind: "supplement",
      supplementId: s._id,
      groupId: null,
      name: s.name,
      imageUrl: s.imageUrl ?? null,
      onHand: ledger.onHand,
      incomingCount: ledger.incomingCount,
      ratePerDay: rate,
      daysLeft: Number.isFinite(days) ? days : null,
      brands: [s],
      defaultBrand: s,
    });
  }

  for (const g of groups) {
    const members = supplements.filter((s) => s.groupId === g._id);
    const dosages = [];
    const weeklies: { personId: string; weekly: number }[] = [];
    for (const m of members) {
      for (const d of await getPersonActiveDosages(ctx, m._id)) {
        dosages.push(d);
      }
      for (const d of await getActiveDosages(ctx, m._id)) {
        weeklies.push({ personId: d.personId, weekly: getDosageWeekly(d) });
      }
    }
    const rate = getGroupRate(weeklies);
    const ledger = getGroupStateForDosages(
      members.map((m) => ({
        supplementId: m._id as string,
        bottles: bottlesOf.get(m._id) ?? [],
      })),
      g.anchoredAt,
      dosages,
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
      incomingCount: ledger.incomingCount,
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

async function listCandidatesForItem(
  ctx: QueryCtx | MutationCtx,
  item: Doc<"restockItems">
): Promise<Doc<"candidateProducts">[]> {
  if (item.supplementId) {
    return await ctx.db
      .query("candidateProducts")
      .withIndex("by_supplement", (q) => q.eq("supplementId", item.supplementId))
      .collect();
  }
  if (item.groupId) {
    return await ctx.db
      .query("candidateProducts")
      .withIndex("by_group", (q) => q.eq("groupId", item.groupId))
      .collect();
  }
  return [];
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

const candidateSummary = v.object({
  _id: v.id("candidateProducts"),
  retailerId: v.id("retailers"),
  retailerName: v.string(),
  url: v.string(),
  label: v.string(),
  count: v.union(v.number(), v.null()),
});

const basketLineValidator = v.object({
  itemId: v.id("restockItems"),
  itemName: v.string(),
  candidateId: v.id("candidateProducts"),
  candidateLabel: v.string(),
  qty: v.number(),
  unitPrice: v.union(v.number(), v.null()),
  lineTotal: v.union(v.number(), v.null()),
  perPill: v.union(v.number(), v.null()),
});

const basketValidator = v.object({
  retailerId: v.id("retailers"),
  retailerName: v.string(),
  freeShippingThreshold: v.optional(v.number()),
  standardShippingCost: v.optional(v.number()),
  lines: v.array(basketLineValidator),
  subtotal: v.number(),
  complete: v.boolean(),
  appliedShipping: v.union(v.number(), v.null()),
  allIn: v.union(v.number(), v.null()),
  shippingUnknown: v.boolean(),
  gapToFreeShipping: v.union(v.number(), v.null()),
  freeShippingMet: v.boolean(),
  thresholdUnset: v.boolean(),
  cheapest: v.boolean(),
});

const planItemValidator = v.object({
  _id: v.id("restockItems"),
  qty: v.number(),
  addedAt: v.number(),
  subjectKind: v.union(v.literal("supplement"), v.literal("group")),
  supplementId: v.union(v.id("supplements"), v.null()),
  groupId: v.union(v.id("groups"), v.null()),
  name: v.string(),
  imageUrl: v.union(v.string(), v.null()),
  onHand: v.number(),
  incomingCount: v.number(),
  daysLeft: v.union(v.number(), v.null()),
  ratePerDay: v.number(),
  recommendedQty: v.number(),
  defaultJarSize: v.number(),
  selectedCandidateId: v.union(v.id("candidateProducts"), v.null()),
  enteredPrice: v.union(v.number(), v.null()),
  candidates: v.array(candidateSummary),
  // Requires ≥2 candidates with entered price + count; with single enteredPrice
  // on the item only the selected candidate is priced — always [] until multi-price.
  lowestPerPillCandidateIds: v.array(v.id("candidateProducts")),
  /** Default existing destination for Mark-as-Purchased (slice 06 temp UI). */
  defaultDestinationSupplementId: v.id("supplements"),
});

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
        incomingCount: v.number(),
        daysLeft: v.union(v.number(), v.null()),
        urgent: v.boolean(),
        onPlan: v.boolean(),
        hasPlanWork: v.boolean(), // entered price or a selection would be lost
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
          incomingCount: s.incomingCount,
          daysLeft: s.daysLeft,
          urgent: s.daysLeft !== null && s.daysLeft <= forecastWindowDays,
          onPlan: item !== undefined,
          hasPlanWork:
            item !== undefined &&
            (item.enteredPrice !== undefined ||
              item.selectedCandidateId !== undefined),
        };
      })
      .sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity));

    return { forecastWindowDays, subjects };
  },
});

/**
 * The whole plan, enriched for the page: each active item with its subject's
 * live forecast, candidate products, and server-derived retailer baskets.
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
        standardShippingCost: v.optional(v.number()),
        createdAt: v.number(),
      })
    ),
    items: v.array(planItemValidator),
    baskets: v.array(basketValidator),
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
    const retailerById = new Map(retailers.map((r) => [r._id, r]));

    type EnrichedItem = {
      _id: Id<"restockItems">;
      qty: number;
      addedAt: number;
      subjectKind: "supplement" | "group";
      supplementId: Id<"supplements"> | null;
      groupId: Id<"groups"> | null;
      name: string;
      imageUrl: string | null;
      onHand: number;
      incomingCount: number;
      daysLeft: number | null;
      ratePerDay: number;
      recommendedQty: number;
      defaultJarSize: number;
      selectedCandidateId: Id<"candidateProducts"> | null;
      enteredPrice: number | null;
      candidates: Array<{
        _id: Id<"candidateProducts">;
        retailerId: Id<"retailers">;
        retailerName: string;
        url: string;
        label: string;
        count: number | null;
      }>;
      lowestPerPillCandidateIds: Id<"candidateProducts">[];
      defaultDestinationSupplementId: Id<"supplements">;
    };

    const enriched: EnrichedItem[] = [];
    const basketGroups = new Map<
      Id<"retailers">,
      {
        item: EnrichedItem;
        candidate: Doc<"candidateProducts">;
      }[]
    >();

    for (const item of items.sort((a, b) => a.addedAt - b.addedAt)) {
      const subject = subjectOf(states, item);
      if (!subject) continue;

      const rawCandidates = await listCandidatesForItem(ctx, item);
      const candidates = rawCandidates.map((c) => ({
        _id: c._id,
        retailerId: c.retailerId,
        retailerName: retailerById.get(c.retailerId)?.name ?? "Unknown",
        url: c.url,
        label: c.label,
        count: c.count ?? null,
      }));

      const selectedCandidate = item.selectedCandidateId
        ? rawCandidates.find((c) => c._id === item.selectedCandidateId) ?? null
        : null;
      const bottleCount = selectedCandidate?.count ?? 0;

      const planItem = {
        _id: item._id,
        qty: item.qty,
        addedAt: item.addedAt,
        subjectKind: subject.kind,
        supplementId: subject.supplementId,
        groupId: subject.groupId,
        name: subject.name,
        imageUrl: subject.imageUrl,
        onHand: subject.onHand,
        incomingCount: subject.incomingCount,
        daysLeft: subject.daysLeft,
        ratePerDay: subject.ratePerDay,
        recommendedQty: getRecommendedQty(
          subject.ratePerDay,
          subject.onHand + subject.incomingCount,
          bottleCount,
          settings.coverageTargetDays
        ),
        defaultJarSize: bottleCount,
        selectedCandidateId: item.selectedCandidateId ?? null,
        enteredPrice: item.enteredPrice ?? null,
        candidates,
        lowestPerPillCandidateIds: lowestPerPillCandidateIds(
          rawCandidates.map((c) => ({
            candidateId: c._id,
            enteredPrice:
              c._id === item.selectedCandidateId
                ? (item.enteredPrice ?? null)
                : null,
            count: c.count ?? null,
          }))
        ) as Id<"candidateProducts">[],
        defaultDestinationSupplementId:
          subject.defaultBrand?._id ?? subject.brands[0]!._id,
      };

      enriched.push(planItem);

      if (selectedCandidate) {
        const lines = basketGroups.get(selectedCandidate.retailerId) ?? [];
        lines.push({ item: planItem, candidate: selectedCandidate });
        basketGroups.set(selectedCandidate.retailerId, lines);
      }
    }

    const baskets = [];
    const nudgeInputs = [];

    for (const [retailerId, group] of basketGroups) {
      const retailer = retailerById.get(retailerId);
      if (!retailer) continue;

      const lineInputs = group.map(({ item, candidate }) => ({
        qty: item.qty,
        enteredPrice: item.enteredPrice,
        candidateCount: candidate.count ?? null,
      }));

      const built = buildBasketLines(lineInputs);
      const basketMath = computeRetailerBasket(lineInputs, {
        freeShippingThreshold: retailer.freeShippingThreshold,
        standardShippingCost: retailer.standardShippingCost,
      });

      const lines = group.map(({ item, candidate }, i) => ({
        itemId: item._id,
        itemName: item.name,
        candidateId: candidate._id,
        candidateLabel: candidate.label,
        qty: item.qty,
        unitPrice: built[i].unitPrice,
        lineTotal: built[i].lineTotal,
        perPill: built[i].perPill,
      }));

      const basket = {
        retailerId,
        retailerName: retailer.name,
        freeShippingThreshold: retailer.freeShippingThreshold,
        standardShippingCost: retailer.standardShippingCost,
        lines,
        ...basketMath,
        cheapest: false,
      };

      baskets.push(basket);
      nudgeInputs.push({
        retailerId: retailerId as string,
        complete: basket.complete,
        shippingUnknown: basket.shippingUnknown,
        allIn: basket.allIn,
      });
    }

    const cheapestIds = new Set(cheapestBasketRetailerIds(nudgeInputs));
    for (const basket of baskets) {
      basket.cheapest = cheapestIds.has(basket.retailerId as string);
    }

    return { ...settings, retailers, items: enriched, baskets };
  },
});

// --- Mutations ---------------------------------------------------------------

/**
 * Reconcile plan membership to the picker's checked set — the modal is the only
 * membership editor, and doing it in one mutation makes concurrent edits safe
 * (at most one active item per subject). Removed items are deleted; prices and
 * selection die with the session row.
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

    for (const item of items) {
      const keep = item.groupId
        ? wantGroup.has(item.groupId)
        : item.supplementId
          ? wantSupp.has(item.supplementId)
          : false;
      if (!keep) await ctx.db.delete(item._id);
    }

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
          s.onHand + s.incomingCount,
          s.defaultBrand?.jarSize ?? 0,
          coverageTargetDays
        ),
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

/** Enter (or clear, with null) the cycle-scoped sticker price for the item. */
export const setPrice = mutation({
  args: {
    id: v.id("restockItems"),
    price: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  async handler(ctx, { id, price }) {
    const item = await requireActiveItem(ctx, id);
    if (price !== null && price >= 0 && Number.isFinite(price)) {
      await ctx.db.patch(item._id, { enteredPrice: price });
    } else {
      await ctx.db.patch(item._id, { enteredPrice: undefined });
    }
    return null;
  },
});

/**
 * Select a candidate product for this item — or clear with null. Totals
 * recompute reactively from the derived baskets.
 */
export const selectCandidate = mutation({
  args: {
    id: v.id("restockItems"),
    candidateId: v.union(v.id("candidateProducts"), v.null()),
  },
  returns: v.null(),
  async handler(ctx, { id, candidateId }) {
    const item = await requireActiveItem(ctx, id);
    if (candidateId === null) {
      await ctx.db.patch(item._id, { selectedCandidateId: undefined });
      return null;
    }
    const candidate = await ctx.db.get(candidateId);
    if (!candidate || candidate.householdId !== item.householdId) {
      throw new Error("Candidate not found.");
    }
    const valid = item.groupId
      ? candidate.groupId === item.groupId
      : item.supplementId === candidate.supplementId;
    if (!valid) {
      throw new Error("That candidate doesn't fulfil this item.");
    }
    await ctx.db.patch(item._id, { selectedCandidateId: candidateId });
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

const purchaseDestinationValidator = v.union(
  v.object({
    kind: v.literal("existing"),
    supplementId: v.id("supplements"),
  }),
  v.object({
    kind: v.literal("new"),
    name: v.string(),
    formGroupWithSubjectId: v.optional(v.id("supplements")),
    joinGroupId: v.optional(v.id("groups")),
  })
);

async function resolvePurchaseDestination(
  ctx: MutationCtx,
  item: Doc<"restockItems">,
  destination: {
    kind: "existing";
    supplementId: Id<"supplements">;
  } | {
    kind: "new";
    name: string;
    formGroupWithSubjectId?: Id<"supplements">;
    joinGroupId?: Id<"groups">;
  },
  jarSize: number
): Promise<Id<"supplements">> {
  if (destination.kind === "existing") {
    const supplement = await requireSupplementAccess(ctx, destination.supplementId);
    if (!supplement) throw new Error("Destination supplement not found.");

    const itemSubject = item.groupId
      ? { kind: "group" as const, groupId: item.groupId }
      : {
          kind: "supplement" as const,
          supplementId: item.supplementId!,
        };
    const groupMemberIds = item.groupId
      ? (await groupMembers(ctx, item.groupId)).map((m) => m._id)
      : [];

    assertExistingDestinationAllowed({
      itemSubject,
      destinationSupplementId: destination.supplementId,
      groupMemberIds,
    });
    return destination.supplementId;
  }

  const name = destination.name.trim();
  if (!name) throw new Error("New supplement name is required.");

  if (destination.formGroupWithSubjectId && destination.joinGroupId) {
    throw new Error("Cannot form a group and join a group on the same purchase.");
  }
  if (destination.formGroupWithSubjectId) {
    if (item.groupId) {
      throw new Error("Form-group is only valid for solo subjects.");
    }
    if (destination.formGroupWithSubjectId !== item.supplementId) {
      throw new Error("Form-group subject must match the plan item.");
    }
  }
  if (destination.joinGroupId) {
    if (!item.groupId) {
      throw new Error("Join-group is only valid for group subjects.");
    }
    if (destination.joinGroupId !== item.groupId) {
      throw new Error("Join-group must match the plan item's group.");
    }
  }

  const now = Date.now();
  const newSupplementId = await ctx.db.insert("supplements", {
    householdId: item.householdId,
    name,
    jarSize,
    quantityAnchor: 0,
    anchoredAt: now,
    createdAt: now,
  });

  if (destination.joinGroupId) {
    await addSupplementToGroup(ctx, destination.joinGroupId, newSupplementId);
    return newSupplementId;
  }

  if (destination.formGroupWithSubjectId) {
    const subject = await ctx.db.get(destination.formGroupWithSubjectId);
    if (!subject) throw new Error("Subject supplement not found.");
    const dosages = await groupDosageTemplate(ctx, destination.formGroupWithSubjectId);
    await createGroupFromSupplements(ctx, {
      householdId: item.householdId,
      name: subject.name,
      category: subject.category,
      supplementIds: [destination.formGroupWithSubjectId, newSupplementId],
      dosages,
    });
    return newSupplementId;
  }

  return newSupplementId;
}

/**
 * Complete one retailer order (Q7). Each confirmed line lands as `qty`
 * individual bottle rows on the chosen destination supplement — full at a fresh
 * anchor. Candidates stay durable; destinations are explicit (match-or-add).
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
        destination: purchaseDestinationValidator,
      })
    ),
  },
  returns: v.null(),
  async handler(ctx, { retailerId, purchasedAt, lines }) {
    const retailer = await ctx.db.get(retailerId);
    if (!retailer) throw new Error("Retailer not found.");
    await requireMembership(ctx, retailer.householdId);

    if (!Number.isFinite(purchasedAt)) {
      throw new Error("Invalid purchase date.");
    }

    const now = Date.now();
    for (const line of lines) {
      const item = await requireActiveItem(ctx, line.itemId);
      if (item.householdId !== retailer.householdId) {
        throw new Error("Item and retailer belong to different households.");
      }
      if (!item.selectedCandidateId) {
        throw new Error("No candidate selected for an item.");
      }
      const candidate = await ctx.db.get(item.selectedCandidateId);
      if (!candidate || candidate.retailerId !== retailerId) {
        throw new Error(`"${item._id}" isn't assigned to this retailer.`);
      }

      const qty = Math.max(1, Math.round(line.qty));
      const countFromLine = Math.round(line.countPerBottle);
      const count = Math.max(
        1,
        Number.isFinite(countFromLine) && countFromLine >= 1
          ? countFromLine
          : (candidate.count ?? 1)
      );
      const price = Math.max(0, line.pricePerBottle);
      const url = candidate.url;

      const destinationSupplementId = await resolvePurchaseDestination(
        ctx,
        item,
        line.destination,
        count
      );

      await reanchorFor(ctx, destinationSupplementId);
      for (let i = 0; i < qty; i++) {
        await ctx.db.insert("bottles", {
          supplementId: destinationSupplementId,
          count,
          price,
          purchaseUrl: url,
          retailerId,
          purchasedAt,
          remainingAtAnchor: count,
        });
      }
      await syncAnchorCache(ctx, destinationSupplementId);
      await upsertSavedLink(
        ctx,
        item.householdId,
        destinationSupplementId,
        retailerId,
        url
      );

      await ctx.db.patch(item._id, { status: "purchased", purchasedAt: now });
    }
    return null;
  },
});
