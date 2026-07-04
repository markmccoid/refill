import { query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireMembership } from "./authz";
import { getGroupState } from "../lib/supplement-utils";
import {
  aggregateSupplement,
  dosageWeekly,
  finalizeNutrients,
  type FactsLike,
  type PersonNutrients,
} from "../lib/nutrient-utils";

/**
 * Per-person nutrient aggregation (the data behind /insights). For each active
 * person, sum every nutrient's %DV across the supplements they take, scaled by
 * their daily servings of each. Groups contribute only the open brand's facts
 * (ADR-0004: one brand at a time). Supplements without DSLD facts, or missing
 * the size fields needed to derive servings/day, are returned per-person as
 * `skipped` so the UI can say so.
 */
export const summary = query({
  args: { householdId: v.id("households") },
  async handler(ctx, { householdId }) {
    await requireMembership(ctx, householdId);

    const people = (
      await ctx.db
        .query("people")
        .withIndex("by_household", (q) => q.eq("householdId", householdId))
        .collect()
    ).filter((p) => p.status !== "disabled");

    const supplements = await ctx.db
      .query("supplements")
      .withIndex("by_household", (q) => q.eq("householdId", householdId))
      .collect();

    // Facts + bottles keyed by supplement id.
    const factsBySupplement = new Map<
      Id<"supplements">,
      Doc<"supplementFacts">
    >();
    const bottlesBySupplement = new Map<
      Id<"supplements">,
      Doc<"bottles">[]
    >();
    const dosagesBySupplement = new Map<
      Id<"supplements">,
      Doc<"dosages">[]
    >();
    for (const s of supplements) {
      const facts = await ctx.db
        .query("supplementFacts")
        .withIndex("by_supplement", (q) => q.eq("supplementId", s._id))
        .unique();
      if (facts) factsBySupplement.set(s._id, facts);

      const bottles = await ctx.db
        .query("bottles")
        .withIndex("by_supplement", (q) => q.eq("supplementId", s._id))
        .collect();
      bottlesBySupplement.set(s._id, bottles);

      const dosages = await ctx.db
        .query("dosages")
        .withIndex("by_supplement", (q) => q.eq("supplementId", s._id))
        .collect();
      dosagesBySupplement.set(s._id, dosages);
    }

    // Dosages grouped by person → { supplementId, weekly } for active people.
    const personDosages = new Map<
      Id<"people">,
      { supplementId: Id<"supplements">; weekly: number }[]
    >();
    for (const p of people) personDosages.set(p._id, []);
    for (const s of supplements) {
      for (const d of dosagesBySupplement.get(s._id) ?? []) {
        const list = personDosages.get(d.personId);
        if (!list) continue; // disabled person
        list.push({ supplementId: s._id, weekly: dosageWeekly(d) });
      }
    }

    // Group: supplementId → groupId (for the members we still need to attribute).
    const groups = await ctx.db
      .query("groups")
      .withIndex("by_household", (q) => q.eq("householdId", householdId))
      .collect();

    // For each group, precompute which member brand is open (the one whose
    // facts count). Determined by the pooled FIFO walk at the group's rate.
    const groupOpenBrand = new Map<Id<"groups">, Id<"supplements"> | null>();
    const groupMembers = new Map<Id<"groups">, Doc<"supplements">[]>();
    for (const g of groups) {
      const members = supplements.filter((s) => s.groupId === g._id);
      groupMembers.set(g._id, members);
      const memberBottles = members.map((m) => ({
        supplementId: m._id,
        bottles: bottlesBySupplement.get(m._id) ?? [],
      }));
      // Group rate from current dosages (any active taker) just to find the
      // open bottle; the exact rate doesn't change which bottle is open.
      const allDosages = members.flatMap(
        (m) => dosagesBySupplement.get(m._id) ?? []
      );
      const activeDosages = allDosages.filter((d) =>
        people.some((p) => p._id === d.personId)
      );
      const ratePerWeek = activeDosages.reduce(
        (sum, d) => sum + dosageWeekly(d),
        0
      );
      const ratePerDay = ratePerWeek / 7;
      const state = getGroupState(
        memberBottles,
        g.anchoredAt,
        ratePerDay
      );
      groupOpenBrand.set(
        g._id,
        (state.openSupplementId as Id<"supplements"> | null) ?? null
      );
    }

    // A "consumed subject" per person is either a solo supplement or a group.
    // Build that list, then for each subject pick the facts doc to count.
    const result: PersonNutrients[] = [];

    for (const person of people) {
      const taken = personDosages.get(person._id) ?? [];

      const acc = {
        nutrients: new Map<
          string,
          PersonNutrients["nutrients"][number]
        >(),
        noDv: [] as PersonNutrients["noDv"],
      };
      const skipped: { name: string; reason: string }[] = [];

      // De-duplicate groups: one entry per group a person takes.
      const seenGroup = new Set<Id<"groups">>();

      for (const { supplementId, weekly } of taken) {
        const supplement = supplements.find((s) => s._id === supplementId);
        if (!supplement) continue;

        // Grouped supplement: attribute only the open brand's facts, once.
        if (supplement.groupId) {
          const groupId = supplement.groupId;
          if (seenGroup.has(groupId)) continue;
          seenGroup.add(groupId);

          const openId = groupOpenBrand.get(groupId);
          const members = groupMembers.get(groupId) ?? [];
          const openSupplement = openId
            ? members.find((m) => m._id === openId)
            : null;

          if (!openSupplement) {
            skipped.push({
              name: groups.find((g) => g._id === groupId)?.name ?? "Group",
              reason: "No open bottle",
            });
            continue;
          }
          const facts = factsBySupplement.get(openSupplement._id);
          if (!facts) {
            skipped.push({
              name: openSupplement.name,
              reason: "No label data",
            });
            continue;
          }
          aggregateSupplement(
            acc,
            { _id: openSupplement._id, name: openSupplement.name, jarSize: openSupplement.jarSize },
            facts as unknown as FactsLike,
            weekly
          );
          continue;
        }

        // Solo supplement.
        const facts = factsBySupplement.get(supplementId);
        if (!facts) {
          skipped.push({ name: supplement.name, reason: "No label data" });
          continue;
        }
        aggregateSupplement(
          acc,
          { _id: supplement._id, name: supplement.name, jarSize: supplement.jarSize },
          facts as unknown as FactsLike,
          weekly
        );
      }

      result.push({
        personId: person._id,
        name: person.name,
        color: person.color,
        nutrients: finalizeNutrients(acc.nutrients),
        noDv: acc.noDv,
        skipped,
      });
    }

    return { people: result };
  },
});
