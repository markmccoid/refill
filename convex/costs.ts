import { query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  getConsumptionRate,
  getBottleStatesForDosages,
  getGroupStateForDosages,
  getGroupRate,
  getSpendRatePerDay,
  getLifetimeSpent,
  getEffectiveDosageWeekly,
} from "../lib/supplement-utils";
import { requireMembership } from "./authz";

/**
 * Household spend summary (ADR-0002): a current-rate snapshot per person
 * (day/week/month) plus lifetime totals per supplement and household. Spend is
 * cost-of-consumption — each person's rate × the open bottle's cost-per-pill.
 * Lifetime is money paid (all bottle prices) and is not split per person.
 */
export const summary = query({
  args: { householdId: v.id("households") },
  async handler(ctx, { householdId }) {
    await requireMembership(ctx, householdId);
    // Costs reflect current consumption, so disabled (paused) people are
    // dropped entirely — their dosages neither drive the rate nor get a row.
    const people = (
      await ctx.db
        .query("people")
        .withIndex("by_household", (q) => q.eq("householdId", householdId))
        .collect()
    ).filter((p) => p.status !== "disabled");
    const activePersonIds = new Set(people.map((p) => p._id));

    const supplements = await ctx.db
      .query("supplements")
      .withIndex("by_household", (q) => q.eq("householdId", householdId))
      .collect();

    const perPersonDay = new Map<string, number>();
    for (const p of people) perPersonDay.set(p._id, 0);

    const perSupplement: {
      supplementId: string;
      name: string;
      perMonth: number;
      lifetime: number;
    }[] = [];
    const perPersonSupplement: {
      personId: string;
      supplementId: string;
      name: string;
      pillsPerWeek: number;
      costPerPill: number;
      perDay: number;
      perMonth: number;
    }[] = [];

    let householdLifetime = 0;

    // Ungrouped supplements: each depletes on its own (unchanged).
    for (const s of supplements.filter((x) => !x.groupId)) {
      const dosages = (
        await ctx.db
          .query("dosages")
          .withIndex("by_supplement", (q) => q.eq("supplementId", s._id))
          .collect()
      ).filter((d) => activePersonIds.has(d.personId));
      const bottles = await ctx.db
        .query("bottles")
        .withIndex("by_supplement", (q) => q.eq("supplementId", s._id))
        .collect();

      const now = Date.now();
      const rate = getConsumptionRate(dosages, now);
      const anchoredAt = s.anchoredAt ?? s.createdAt ?? Date.now();
      const { openCostPerPill } = getBottleStatesForDosages(
        bottles,
        anchoredAt,
        dosages,
        now
      );
      const lifetime = getLifetimeSpent(bottles);

      perSupplement.push({
        supplementId: s._id,
        name: s.name,
        perMonth: getSpendRatePerDay(rate, openCostPerPill) * 30,
        lifetime,
      });
      householdLifetime += lifetime;

      // Attribute the rate to each taker by their share of consumption.
      for (const d of dosages) {
        const pillsPerWeek = getEffectiveDosageWeekly(d);
        const perDay = getSpendRatePerDay(
          getConsumptionRate([d], now),
          openCostPerPill
        );
        perPersonSupplement.push({
          personId: d.personId,
          supplementId: s._id,
          name: s.name,
          pillsPerWeek,
          costPerPill: openCostPerPill,
          perDay,
          perMonth: perDay * 30,
        });
        perPersonDay.set(
          d.personId,
          (perPersonDay.get(d.personId) ?? 0) + perDay
        );
      }
    }

    // Groups: consumed one brand at a time, so a group counts ONCE at its pooled
    // rate × the open (cross-brand) bottle's cost-per-pill — never per member,
    // which would double-count spend (ADR-0004).
    const groups = await ctx.db
      .query("groups")
      .withIndex("by_household", (q) => q.eq("householdId", householdId))
      .collect();

    for (const g of groups) {
      const members = await ctx.db
        .query("supplements")
        .withIndex("by_group", (q) => q.eq("groupId", g._id))
        .collect();

      // Per-person weekly across members (max per person), active people only.
      const perPersonWeekly = new Map<string, number>();
      const memberDosages: (Doc<"dosages"> & { personId: string })[] = [];
      const memberBottles: {
        supplementId: Id<"supplements">;
        bottles: Doc<"bottles">[];
      }[] = [];
      let lifetime = 0;
      for (const m of members) {
        const bottles = await ctx.db
          .query("bottles")
          .withIndex("by_supplement", (q) => q.eq("supplementId", m._id))
          .collect();
        memberBottles.push({ supplementId: m._id, bottles });
        lifetime += getLifetimeSpent(bottles);
        const dosages = (
          await ctx.db
            .query("dosages")
            .withIndex("by_supplement", (q) => q.eq("supplementId", m._id))
            .collect()
        ).filter((d) => activePersonIds.has(d.personId));
        for (const d of dosages) {
          memberDosages.push(d);
          const w = getEffectiveDosageWeekly(d);
          perPersonWeekly.set(
            d.personId,
            Math.max(perPersonWeekly.get(d.personId) ?? 0, w)
          );
        }
      }

      const rate = getGroupRate(
        [...perPersonWeekly.entries()].map(([personId, weekly]) => ({
          personId,
          weekly,
        }))
      );
      const { openCostPerPill } = getGroupStateForDosages(
        memberBottles,
        g.anchoredAt,
        memberDosages
      );

      perSupplement.push({
        supplementId: g._id,
        name: g.name,
        perMonth: getSpendRatePerDay(rate, openCostPerPill) * 30,
        lifetime,
      });
      householdLifetime += lifetime;

      for (const [personId, weekly] of perPersonWeekly) {
        const perDay = getSpendRatePerDay(weekly / 7, openCostPerPill);
        perPersonSupplement.push({
          personId,
          supplementId: g._id,
          name: g.name,
          pillsPerWeek: weekly,
          costPerPill: openCostPerPill,
          perDay,
          perMonth: perDay * 30,
        });
        perPersonDay.set(personId, (perPersonDay.get(personId) ?? 0) + perDay);
      }
    }

    const perPerson = people.map((p) => {
      const perDay = perPersonDay.get(p._id) ?? 0;
      return {
        personId: p._id,
        name: p.name,
        color: p.color,
        perDay,
        perWeek: perDay * 7,
        perMonth: perDay * 30,
      };
    });

    const householdPerDay = perPerson.reduce((sum, p) => sum + p.perDay, 0);

    return {
      perPerson,
      perSupplement: perSupplement.sort((a, b) => b.perMonth - a.perMonth),
      perPersonSupplement: perPersonSupplement.sort((a, b) => b.perMonth - a.perMonth),
      household: {
        perDay: householdPerDay,
        perWeek: householdPerDay * 7,
        perMonth: householdPerDay * 30,
        lifetime: householdLifetime,
      },
    };
  },
});
