import { internalMutation, mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  requireGroupAccess,
  requireSupplementAccess,
} from "./authz";
import { validateSubjectXor } from "../lib/candidate-product-utils";
import {
  collectSeedSourcesForGroup,
  collectSeedSourcesForSupplement,
  filterNovelSeedSources,
  pickBottleCount,
  type BottleInput,
  type SavedLinkInput,
  type SeedSource,
  type SupplementInput,
} from "../lib/candidate-seeding-utils";
import { normalizeCandidateUrl } from "../lib/candidate-product-utils";

type SubjectRef = {
  householdId: Id<"households">;
  supplementId?: Id<"supplements">;
  groupId?: Id<"groups">;
};

async function resolveSubject(
  ctx: QueryCtx | MutationCtx,
  supplementId?: Id<"supplements">,
  groupId?: Id<"groups">
): Promise<SubjectRef> {
  validateSubjectXor({ supplementId, groupId });
  if (supplementId) {
    const supplement = await requireSupplementAccess(ctx, supplementId);
    return { householdId: supplement.householdId, supplementId };
  }
  const group = await requireGroupAccess(ctx, groupId!);
  return { householdId: group.householdId, groupId };
}

async function listCandidatesForSubject(
  ctx: QueryCtx | MutationCtx,
  subject: Pick<SubjectRef, "supplementId" | "groupId">
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

async function supplementsForSubject(
  ctx: QueryCtx | MutationCtx,
  subject: SubjectRef
): Promise<Array<{ _id: Id<"supplements">; name: string; jarSize: number }>> {
  if (subject.supplementId) {
    const supplement = await ctx.db.get(subject.supplementId);
    if (!supplement) throw new Error("Supplement not found.");
    return [supplement];
  }

  const members = await ctx.db
    .query("supplements")
    .withIndex("by_group", (q) => q.eq("groupId", subject.groupId))
    .collect();
  return members;
}

async function loadSavedLinks(
  ctx: QueryCtx | MutationCtx,
  supplementIds: Id<"supplements">[]
): Promise<SavedLinkInput[]> {
  const links: SavedLinkInput[] = [];
  for (const supplementId of supplementIds) {
    const rows = await ctx.db
      .query("savedLinks")
      .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
      .collect();
    for (const row of rows) {
      links.push({
        supplementId: row.supplementId,
        retailerId: row.retailerId,
        url: row.url,
      });
    }
  }
  return links;
}

async function loadBottles(
  ctx: QueryCtx | MutationCtx,
  supplementIds: Id<"supplements">[]
): Promise<BottleInput[]> {
  const bottles: BottleInput[] = [];
  for (const supplementId of supplementIds) {
    const rows = await ctx.db
      .query("bottles")
      .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
      .collect();
    for (const row of rows) {
      bottles.push({
        supplementId: row.supplementId,
        retailerId: row.retailerId,
        purchaseUrl: row.purchaseUrl,
        count: row.count,
        purchasedAt: row.purchasedAt,
      });
    }
  }
  return bottles;
}

function toSupplementInput(
  supplement: { _id: Id<"supplements">; name: string; jarSize: number }
): SupplementInput {
  return { id: supplement._id, name: supplement.name, jarSize: supplement.jarSize };
}

async function collectSeedSourcesForSubject(
  ctx: QueryCtx | MutationCtx,
  subject: SubjectRef
): Promise<SeedSource[]> {
  const members = await supplementsForSubject(ctx, subject);
  if (members.length === 0) return [];

  const supplementIds = members.map((m) => m._id);
  const savedLinks = await loadSavedLinks(ctx, supplementIds);
  const bottles = await loadBottles(ctx, supplementIds);
  const memberInputs = members.map(toSupplementInput);

  if (subject.groupId) {
    return collectSeedSourcesForGroup(memberInputs, savedLinks, bottles);
  }
  return collectSeedSourcesForSupplement(memberInputs[0], savedLinks, bottles);
}

async function novelSeedSourcesForSubject(
  ctx: QueryCtx | MutationCtx,
  subject: SubjectRef
): Promise<SeedSource[]> {
  const sources = await collectSeedSourcesForSubject(ctx, subject);
  const existing = await listCandidatesForSubject(ctx, subject);
  return filterNovelSeedSources(
    sources,
    existing.map((c) => c.url)
  );
}

async function insertSeedCandidates(
  ctx: MutationCtx,
  subject: SubjectRef,
  sources: SeedSource[]
): Promise<number> {
  let created = 0;
  const now = Date.now();
  for (const source of sources) {
    await ctx.db.insert("candidateProducts", {
      householdId: subject.householdId,
      supplementId: subject.supplementId,
      groupId: subject.groupId,
      retailerId: source.retailerId as Id<"retailers">,
      url: source.url,
      label: source.label,
      count: source.count,
      createdAt: now,
    });
    created++;
  }
  return created;
}

/** Restock subject for a supplement's saved link: solo supplement or its group. */
function subjectForSupplementLink(supplement: {
  householdId: Id<"households">;
  _id: Id<"supplements">;
  groupId?: Id<"groups">;
}): SubjectRef {
  if (supplement.groupId) {
    return { householdId: supplement.householdId, groupId: supplement.groupId };
  }
  return { householdId: supplement.householdId, supplementId: supplement._id };
}

export const previewImport = query({
  args: {
    supplementId: v.optional(v.id("supplements")),
    groupId: v.optional(v.id("groups")),
  },
  returns: v.object({ newCount: v.number() }),
  async handler(ctx, { supplementId, groupId }) {
    const subject = await resolveSubject(ctx, supplementId, groupId);
    const novel = await novelSeedSourcesForSubject(ctx, subject);
    return { newCount: novel.length };
  },
});

export const importForSubject = mutation({
  args: {
    supplementId: v.optional(v.id("supplements")),
    groupId: v.optional(v.id("groups")),
  },
  returns: v.object({ created: v.number() }),
  async handler(ctx, { supplementId, groupId }) {
    const subject = await resolveSubject(ctx, supplementId, groupId);
    const novel = await novelSeedSourcesForSubject(ctx, subject);
    const created = await insertSeedCandidates(ctx, subject, novel);
    return { created };
  },
});

/** Silent one-time / per-household seed for all solo supplements and groups. */
export async function seedHouseholdInCtx(
  ctx: MutationCtx,
  householdId: Id<"households">
): Promise<{ subjects: number; created: number }> {
  let subjects = 0;
  let created = 0;

  const supplements = await ctx.db
    .query("supplements")
    .withIndex("by_household", (q) => q.eq("householdId", householdId))
    .collect();

  for (const supplement of supplements) {
    if (supplement.groupId) continue;
    const subject: SubjectRef = {
      householdId,
      supplementId: supplement._id,
    };
    const novel = await novelSeedSourcesForSubject(ctx, subject);
    created += await insertSeedCandidates(ctx, subject, novel);
    subjects++;
  }

  const groups = await ctx.db
    .query("groups")
    .withIndex("by_household", (q) => q.eq("householdId", householdId))
    .collect();

  for (const group of groups) {
    const subject: SubjectRef = { householdId, groupId: group._id };
    const novel = await novelSeedSourcesForSubject(ctx, subject);
    created += await insertSeedCandidates(ctx, subject, novel);
    subjects++;
  }

  return { subjects, created };
}

export const seedHousehold = internalMutation({
  args: { householdId: v.id("households") },
  returns: v.object({ subjects: v.number(), created: v.number() }),
  async handler(ctx, { householdId }) {
    return await seedHouseholdInCtx(ctx, householdId);
  },
});

/**
 * Auto-add a candidate when a saved link is written, if the URL is novel on
 * the relevant subject (solo supplement or group when grouped).
 */
export async function maybeSeedFromSavedLink(
  ctx: MutationCtx,
  householdId: Id<"households">,
  supplementId: Id<"supplements">,
  retailerId: Id<"retailers">,
  url: string
): Promise<void> {
  const trimmed = normalizeCandidateUrl(url);
  if (!trimmed) return;

  const supplement = await ctx.db.get(supplementId);
  if (!supplement || supplement.householdId !== householdId) return;

  const subject = subjectForSupplementLink(supplement);
  const existing = await listCandidatesForSubject(ctx, subject);
  const novel = filterNovelSeedSources(
    [
      {
        supplementId,
        retailerId,
        url: trimmed,
        label: supplement.name.trim(),
        count: await pickCountForLink(ctx, supplementId, retailerId),
      },
    ],
    existing.map((c) => c.url)
  );
  if (novel.length === 0) return;
  await insertSeedCandidates(ctx, subject, novel);
}

/**
 * When a saved link URL changes: add candidate for the new URL if missing;
 * leave any candidate with the old URL untouched.
 */
export async function maybeSeedFromUrlChange(
  ctx: MutationCtx,
  householdId: Id<"households">,
  supplementId: Id<"supplements">,
  retailerId: Id<"retailers">,
  oldUrl: string,
  newUrl: string
): Promise<void> {
  const trimmedOld = normalizeCandidateUrl(oldUrl);
  const trimmedNew = normalizeCandidateUrl(newUrl);
  if (!trimmedNew || trimmedOld === trimmedNew) return;
  await maybeSeedFromSavedLink(
    ctx,
    householdId,
    supplementId,
    retailerId,
    trimmedNew
  );
}

async function pickCountForLink(
  ctx: MutationCtx,
  supplementId: Id<"supplements">,
  retailerId: Id<"retailers">
): Promise<number | undefined> {
  const supplement = await ctx.db.get(supplementId);
  if (!supplement) return undefined;
  const bottles = await ctx.db
    .query("bottles")
    .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
    .collect();
  return pickBottleCount(
    toSupplementInput(supplement),
    bottles.map((b) => ({
      supplementId: b.supplementId,
      retailerId: b.retailerId,
      purchaseUrl: b.purchaseUrl,
      count: b.count,
      purchasedAt: b.purchasedAt,
    })),
    retailerId
  );
}
