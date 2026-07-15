import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireMembership, requireRetailerAccess } from "./authz";
import { getUrlHost, guessRetailerName } from "../lib/restock-utils";
import {
  maybeSeedFromSavedLink,
  maybeSeedFromUrlChange,
} from "./candidateSeeding";

// Retailers are household-scoped and managed inline where they're felt (offer
// rows + order cards) — no dedicated page, no delete in v1 (ADR-0006).

/**
 * Wire a bottle's purchase URL into the retailer model as a side effect of
 * normal bottle logging (ADR-0006): match its domain to an existing household
 * retailer (creating one with a guessed name if new), and write the product
 * URL through as the (supplement, retailer) saved link — most recent purchase
 * URL wins. Returns the retailer id to stamp on the bottle, or null when the
 * string isn't a usable web URL. This is what pre-fills the Restock planner's
 * retailers, Check Site links, and average prices without any extra user work.
 */
export async function linkPurchaseUrl(
  ctx: MutationCtx,
  householdId: Id<"households">,
  supplementId: Id<"supplements">,
  url: string
): Promise<Id<"retailers"> | null> {
  const host = getUrlHost(url);
  if (!host) return null;

  const retailers = await ctx.db
    .query("retailers")
    .withIndex("by_household", (q) => q.eq("householdId", householdId))
    .collect();
  const guessed = guessRetailerName(url).toLowerCase();
  const existing = retailers.find((r) => {
    const rHost = r.baseUrl ? getUrlHost(r.baseUrl) : null;
    return rHost === host || r.name.trim().toLowerCase() === guessed;
  });
  const retailerId =
    existing?._id ??
    (await ctx.db.insert("retailers", {
      householdId,
      name: guessRetailerName(url),
      baseUrl: `https://${host}`,
      createdAt: Date.now(),
    }));

  const links = await ctx.db
    .query("savedLinks")
    .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
    .collect();
  const mine = links.find((l) => l.retailerId === retailerId);
  const previousUrl = mine?.url;
  if (mine) {
    if (mine.url !== url) await ctx.db.patch(mine._id, { url });
  } else {
    await ctx.db.insert("savedLinks", { supplementId, retailerId, url });
  }

  await maybeSeedFromSavedLink(ctx, householdId, supplementId, retailerId, url);
  if (previousUrl && previousUrl !== url) {
    await maybeSeedFromUrlChange(
      ctx,
      householdId,
      supplementId,
      retailerId,
      previousUrl,
      url
    );
  }

  return retailerId;
}

/** Upsert a saved link for a known retailer (basket purchases). */
export async function upsertSavedLink(
  ctx: MutationCtx,
  householdId: Id<"households">,
  supplementId: Id<"supplements">,
  retailerId: Id<"retailers">,
  url: string
) {
  const trimmed = url.trim();
  if (!trimmed) return;

  const links = await ctx.db
    .query("savedLinks")
    .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
    .collect();
  const mine = links.find((l) => l.retailerId === retailerId);
  const previousUrl = mine?.url;
  if (mine) {
    if (mine.url !== trimmed) await ctx.db.patch(mine._id, { url: trimmed });
  } else {
    await ctx.db.insert("savedLinks", { supplementId, retailerId, url: trimmed });
  }

  await maybeSeedFromSavedLink(ctx, householdId, supplementId, retailerId, trimmed);
  if (previousUrl && previousUrl !== trimmed) {
    await maybeSeedFromUrlChange(
      ctx,
      householdId,
      supplementId,
      retailerId,
      previousUrl,
      trimmed
    );
  }
}

export const list = query({
  args: { householdId: v.id("households") },
  returns: v.array(
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
  async handler(ctx, { householdId }) {
    await requireMembership(ctx, householdId);
    return await ctx.db
      .query("retailers")
      .withIndex("by_household", (q) => q.eq("householdId", householdId))
      .collect();
  },
});

export const create = mutation({
  args: {
    householdId: v.id("households"),
    name: v.string(),
    baseUrl: v.optional(v.string()),
    freeShippingThreshold: v.optional(v.number()),
    standardShippingCost: v.optional(v.number()),
  },
  returns: v.id("retailers"),
  async handler(ctx, {
    householdId,
    name,
    baseUrl,
    freeShippingThreshold,
    standardShippingCost,
  }) {
    await requireMembership(ctx, householdId);
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Retailer name is required.");
    return await ctx.db.insert("retailers", {
      householdId,
      name: trimmed,
      baseUrl: baseUrl?.trim() || undefined,
      freeShippingThreshold:
        freeShippingThreshold && freeShippingThreshold > 0
          ? freeShippingThreshold
          : undefined,
      standardShippingCost:
        standardShippingCost && standardShippingCost > 0
          ? standardShippingCost
          : undefined,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("retailers"),
    name: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
    // null clears the threshold ("we don't know" ≠ $0).
    freeShippingThreshold: v.optional(v.union(v.number(), v.null())),
    // null clears standard shipping ("we don't know" ≠ $0).
    standardShippingCost: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.null(),
  async handler(ctx, {
    id,
    name,
    baseUrl,
    freeShippingThreshold,
    standardShippingCost,
  }) {
    await requireRetailerAccess(ctx, id);
    const patch: Record<string, string | number | undefined> = {};
    if (name !== undefined && name.trim()) patch.name = name.trim();
    if (baseUrl !== undefined) patch.baseUrl = baseUrl.trim() || undefined;
    if (freeShippingThreshold !== undefined) {
      patch.freeShippingThreshold =
        freeShippingThreshold && freeShippingThreshold > 0
          ? freeShippingThreshold
          : undefined;
    }
    if (standardShippingCost !== undefined) {
      patch.standardShippingCost =
        standardShippingCost && standardShippingCost > 0
          ? standardShippingCost
          : undefined;
    }
    await ctx.db.patch(id, patch);
    return null;
  },
});
