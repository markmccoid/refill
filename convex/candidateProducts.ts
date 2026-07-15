import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  requireGroupAccess,
  requireMembership,
  requireRetailerAccess,
  requireSupplementAccess,
} from "./authz";
import {
  hasDuplicateUrl,
  normalizeCandidateUrl,
  validateSubjectXor,
} from "../lib/candidate-product-utils";

// Candidate products (ADR-0009): labeled purchase URLs at retailers for a solo
// supplement XOR a group. Independent of Restock plan rows; URL dedupe is per
// subject (literal trim match).
//
// Lifecycle (wire in later slices — do not implement here):
// - Delete all candidates when the subject (supplement or group) is deleted
// - On Group auto-dissolve → migrate candidates to the surviving supplement, dedupe URL
// - On full Group teardown → delete group candidates with the group

const candidateDoc = v.object({
  _id: v.id("candidateProducts"),
  _creationTime: v.number(),
  householdId: v.id("households"),
  supplementId: v.optional(v.id("supplements")),
  groupId: v.optional(v.id("groups")),
  retailerId: v.id("retailers"),
  url: v.string(),
  label: v.string(),
  count: v.optional(v.number()),
  createdAt: v.number(),
  /** True when an active Restock plan item currently selects this candidate. */
  selectedOnActivePlan: v.boolean(),
});

type ResolvedSubject = {
  householdId: Id<"households">;
  supplementId?: Id<"supplements">;
  groupId?: Id<"groups">;
};

async function resolveSubject(
  ctx: QueryCtx,
  supplementId?: Id<"supplements">,
  groupId?: Id<"groups">
): Promise<ResolvedSubject> {
  validateSubjectXor({ supplementId, groupId });
  if (supplementId) {
    const supplement = await requireSupplementAccess(ctx, supplementId);
    return { householdId: supplement.householdId, supplementId };
  }
  const group = await requireGroupAccess(ctx, groupId!);
  return { householdId: group.householdId, groupId };
}

async function listForSubject(
  ctx: QueryCtx,
  subject: Pick<ResolvedSubject, "supplementId" | "groupId">
) {
  if (subject.supplementId) {
    return await ctx.db
      .query("candidateProducts")
      .withIndex("by_supplement", (q) =>
        q.eq("supplementId", subject.supplementId)
      )
      .collect();
  }
  return await ctx.db
    .query("candidateProducts")
    .withIndex("by_group", (q) => q.eq("groupId", subject.groupId))
    .collect();
}

function normalizeCount(count: number | undefined): number | undefined {
  if (count === undefined) return undefined;
  if (!Number.isFinite(count) || count <= 0) {
    throw new Error("Count must be a positive number.");
  }
  return count;
}

async function selectedCandidateIdsOnActivePlan(
  ctx: QueryCtx | MutationCtx,
  householdId: Id<"households">
): Promise<Set<Id<"candidateProducts">>> {
  const active = await ctx.db
    .query("restockItems")
    .withIndex("by_household_status", (q) =>
      q.eq("householdId", householdId).eq("status", "active")
    )
    .collect();
  const ids = new Set<Id<"candidateProducts">>();
  for (const item of active) {
    if (item.selectedCandidateId) ids.add(item.selectedCandidateId);
  }
  return ids;
}

async function clearActiveSelectionsOfCandidate(
  ctx: MutationCtx,
  householdId: Id<"households">,
  candidateId: Id<"candidateProducts">
): Promise<void> {
  const active = await ctx.db
    .query("restockItems")
    .withIndex("by_household_status", (q) =>
      q.eq("householdId", householdId).eq("status", "active")
    )
    .collect();
  for (const item of active) {
    if (item.selectedCandidateId === candidateId) {
      await ctx.db.patch(item._id, { selectedCandidateId: undefined });
    }
  }
}

export const listBySubject = query({
  args: {
    supplementId: v.optional(v.id("supplements")),
    groupId: v.optional(v.id("groups")),
  },
  returns: v.array(candidateDoc),
  async handler(ctx, { supplementId, groupId }) {
    const subject = await resolveSubject(ctx, supplementId, groupId);
    const rows = await listForSubject(ctx, subject);
    const selected = await selectedCandidateIdsOnActivePlan(
      ctx,
      subject.householdId
    );
    return rows.map((row) => ({
      ...row,
      selectedOnActivePlan: selected.has(row._id),
    }));
  },
});

export const create = mutation({
  args: {
    supplementId: v.optional(v.id("supplements")),
    groupId: v.optional(v.id("groups")),
    retailerId: v.id("retailers"),
    url: v.string(),
    label: v.string(),
    count: v.optional(v.number()),
  },
  returns: v.id("candidateProducts"),
  async handler(ctx, args) {
    const subject = await resolveSubject(
      ctx,
      args.supplementId,
      args.groupId
    );
    const retailer = await requireRetailerAccess(ctx, args.retailerId);
    if (retailer.householdId !== subject.householdId) {
      throw new Error("Retailer belongs to a different household.");
    }

    const trimmedLabel = args.label.trim();
    const trimmedUrl = normalizeCandidateUrl(args.url);
    if (!trimmedLabel) throw new Error("Label is required.");
    if (!trimmedUrl) throw new Error("URL is required.");

    const existing = await listForSubject(ctx, subject);
    if (hasDuplicateUrl(existing, trimmedUrl)) {
      throw new Error("A candidate with this URL already exists for this subject.");
    }

    return await ctx.db.insert("candidateProducts", {
      householdId: subject.householdId,
      supplementId: subject.supplementId,
      groupId: subject.groupId,
      retailerId: args.retailerId,
      url: trimmedUrl,
      label: trimmedLabel,
      count: normalizeCount(args.count),
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("candidateProducts"),
    label: v.optional(v.string()),
    url: v.optional(v.string()),
    count: v.optional(v.union(v.number(), v.null())),
    retailerId: v.optional(v.id("retailers")),
  },
  returns: v.null(),
  async handler(ctx, { id, label, url, count, retailerId }) {
    const candidate = await ctx.db.get(id);
    if (!candidate) throw new Error("Candidate not found.");
    await requireMembership(ctx, candidate.householdId);

    const patch: {
      label?: string;
      url?: string;
      count?: number;
      retailerId?: Id<"retailers">;
    } = {};

    if (label !== undefined) {
      const trimmedLabel = label.trim();
      if (!trimmedLabel) throw new Error("Label is required.");
      patch.label = trimmedLabel;
    }

    if (url !== undefined) {
      const trimmedUrl = normalizeCandidateUrl(url);
      if (!trimmedUrl) throw new Error("URL is required.");
      const siblings = await listForSubject(ctx, candidate);
      if (hasDuplicateUrl(siblings, trimmedUrl, id)) {
        throw new Error(
          "A candidate with this URL already exists for this subject."
        );
      }
      patch.url = trimmedUrl;
    }

    if (count !== undefined) {
      patch.count =
        count === null ? undefined : normalizeCount(count);
    }

    if (retailerId !== undefined) {
      const retailer = await requireRetailerAccess(ctx, retailerId);
      if (retailer.householdId !== candidate.householdId) {
        throw new Error("Retailer belongs to a different household.");
      }
      patch.retailerId = retailerId;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(id, patch);
    }
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("candidateProducts") },
  returns: v.null(),
  async handler(ctx, { id }) {
    const candidate = await ctx.db.get(id);
    if (!candidate) throw new Error("Candidate not found.");
    await requireMembership(ctx, candidate.householdId);
    // ADR-0009: deleting a candidate selected on an active plan item clears
    // that selection (UI confirms first when selectedOnActivePlan).
    await clearActiveSelectionsOfCandidate(
      ctx,
      candidate.householdId,
      id
    );
    await ctx.db.delete(id);
    return null;
  },
});
