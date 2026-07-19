import { MutationCtx, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { reanchorFor, refreshForecastCacheFor } from "./consumption";
import { requireSupplementAccess, requirePersonAccess } from "./authz";
import { Doc, Id } from "./_generated/dataModel";
import { getDosageWeekly, isDosagePaused } from "../lib/supplement-utils";

async function writeEvent(
  ctx: MutationCtx,
  dosage: Pick<Doc<"dosages">, "_id" | "supplementId" | "personId">,
  type: Doc<"dosageEvents">["type"],
  fields: Partial<
    Pick<
      Doc<"dosageEvents">,
      | "previousPillsPerWeek"
      | "nextPillsPerWeek"
      | "pauseStartedAt"
      | "pauseUntil"
    >
  > = {}
) {
  const supplement = await ctx.db.get(dosage.supplementId);
  if (!supplement) return;
  await ctx.db.insert("dosageEvents", {
    householdId: supplement.householdId,
    dosageId: dosage._id,
    supplementId: dosage.supplementId,
    personId: dosage.personId,
    type,
    occurredAt: Date.now(),
    ...fields,
  });
}

export const listBySupplementId = query({
  args: { supplementId: v.id("supplements") },
  async handler(ctx, { supplementId }) {
    await requireSupplementAccess(ctx, supplementId);
    // Tag each dosage with whether its person is active. Disabled people's
    // dosages are still returned (so the detail page can show them as paused)
    // but personActive lets callers exclude them from the consumption rate.
    const dosages = await ctx.db
      .query("dosages")
      .withIndex("by_supplement", (q) => q.eq("supplementId", supplementId))
      .collect();
    const personIds = [...new Set(dosages.map((d) => d.personId))];
    const peopleById = new Map(
      await Promise.all(
        personIds.map(async (id) => [id, await ctx.db.get(id)] as const)
      )
    );
    const now = Date.now();
    return dosages.map((d) => {
      const person = peopleById.get(d.personId);
      const personActive = !!person && person.status !== "disabled";
      const dosagePaused = isDosagePaused(d, now);
      return {
        ...d,
        personActive: personActive && !dosagePaused,
        dosagePaused,
        personDisabled: !personActive,
      };
    });
  },
});

export const listByPersonId = query({
  args: { personId: v.id("people") },
  async handler(ctx, { personId }) {
    await requirePersonAccess(ctx, personId);
    const now = Date.now();
    const dosages = await ctx.db
      .query("dosages")
      .withIndex("by_person", (q) => q.eq("personId", personId))
      .collect();
    return dosages.map((d) => ({
      ...d,
      dosagePaused: isDosagePaused(d, now),
    }));
  },
});

export const create = mutation({
  args: {
    supplementId: v.id("supplements"),
    personId: v.id("people"),
    pillsPerWeek: v.number(),
  },
  async handler(ctx, args) {
    const supplement = await requireSupplementAccess(ctx, args.supplementId);
    await requirePersonAccess(ctx, args.personId);
    // Re-anchor first: freeze on-hand at the old rate before the rate changes.
    await reanchorFor(ctx, args.supplementId);
    const id = await ctx.db.insert("dosages", {
      householdId: supplement.householdId,
      ...args,
    });
    await ctx.db.insert("dosageEvents", {
      householdId: supplement.householdId,
      dosageId: id,
      supplementId: args.supplementId,
      personId: args.personId,
      type: "created",
      occurredAt: Date.now(),
      nextPillsPerWeek: args.pillsPerWeek,
    });
    await refreshForecastCacheFor(ctx, args.supplementId);
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("dosages"),
    pillsPerWeek: v.number(),
  },
  async handler(ctx, { id, ...updates }) {
    const dosage = await ctx.db.get(id);
    if (!dosage) return null;
    await requireSupplementAccess(ctx, dosage.supplementId);
    await reanchorFor(ctx, dosage.supplementId);
    const previousPillsPerWeek = getDosageWeekly(dosage);
    await ctx.db.patch(id, updates);
    await writeEvent(ctx, dosage, "changed", {
      previousPillsPerWeek,
      nextPillsPerWeek: updates.pillsPerWeek,
    });
    await refreshForecastCacheFor(ctx, dosage.supplementId);
    return await ctx.db.get(id);
  },
});

export const pause = mutation({
  args: {
    id: v.id("dosages"),
    pauseUntil: v.optional(v.number()),
  },
  async handler(ctx, { id, pauseUntil }) {
    const dosage = await ctx.db.get(id);
    if (!dosage) return null;
    await requireSupplementAccess(ctx, dosage.supplementId);
    await reanchorFor(ctx, dosage.supplementId);
    const pausedAt = Date.now();
    await ctx.db.patch(id, { pausedAt, pauseUntil });
    await writeEvent(ctx, dosage, "paused", {
      nextPillsPerWeek: getDosageWeekly(dosage),
      pauseStartedAt: pausedAt,
      pauseUntil,
    });
    await refreshForecastCacheFor(ctx, dosage.supplementId);
    return await ctx.db.get(id);
  },
});

export const resume = mutation({
  args: { id: v.id("dosages") },
  async handler(ctx, { id }) {
    const dosage = await ctx.db.get(id);
    if (!dosage) return null;
    await requireSupplementAccess(ctx, dosage.supplementId);
    await reanchorFor(ctx, dosage.supplementId);
    await ctx.db.patch(id, { pausedAt: undefined, pauseUntil: undefined });
    await writeEvent(ctx, dosage, "resumed", {
      nextPillsPerWeek: getDosageWeekly(dosage),
      pauseStartedAt: dosage.pausedAt,
      pauseUntil: dosage.pauseUntil,
    });
    await refreshForecastCacheFor(ctx, dosage.supplementId);
    return await ctx.db.get(id);
  },
});

export const pauseAllForPerson = mutation({
  args: {
    personId: v.id("people"),
    pauseUntil: v.optional(v.number()),
  },
  async handler(ctx, { personId, pauseUntil }) {
    await requirePersonAccess(ctx, personId);
    const dosages = await ctx.db
      .query("dosages")
      .withIndex("by_person", (q) => q.eq("personId", personId))
      .collect();
    const now = Date.now();
    const activeDosages = dosages.filter((d) => !isDosagePaused(d, now));
    const supplementIds = new Set<Id<"supplements">>(
      activeDosages.map((d) => d.supplementId)
    );
    for (const supplementId of supplementIds) {
      await reanchorFor(ctx, supplementId);
    }
    for (const dosage of activeDosages) {
      await ctx.db.patch(dosage._id, { pausedAt: now, pauseUntil });
      await writeEvent(ctx, dosage, "paused", {
        nextPillsPerWeek: getDosageWeekly(dosage),
        pauseStartedAt: now,
        pauseUntil,
      });
    }
    for (const supplementId of supplementIds) {
      await refreshForecastCacheFor(ctx, supplementId);
    }
    return { paused: activeDosages.length };
  },
});

export const remove = mutation({
  args: { id: v.id("dosages") },
  async handler(ctx, { id }) {
    const dosage = await ctx.db.get(id);
    if (!dosage) return;
    await requireSupplementAccess(ctx, dosage.supplementId);
    await reanchorFor(ctx, dosage.supplementId);
    await writeEvent(ctx, dosage, "removed", {
      previousPillsPerWeek: getDosageWeekly(dosage),
    });
    await ctx.db.delete(id);
    await refreshForecastCacheFor(ctx, dosage.supplementId);
  },
});
