import { query } from "./_generated/server";
import { v } from "convex/values";
import {
  getConsumptionRate,
  getBottleStates,
  getSpendRatePerDay,
  getLifetimeSpent,
  getDosageWeekly,
} from "../lib/supplement-utils";

/**
 * Household spend summary (ADR-0002): a current-rate snapshot per person
 * (day/week/month) plus lifetime totals per supplement and household. Spend is
 * cost-of-consumption — each person's rate × the open bottle's cost-per-pill.
 * Lifetime is money paid (all bottle prices) and is not split per person.
 */
export const summary = query({
  args: { householdId: v.id("households") },
  async handler(ctx, { householdId }) {
    const people = await ctx.db
      .query("people")
      .withIndex("by_household", (q) => q.eq("householdId", householdId))
      .collect();

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

    let householdLifetime = 0;

    for (const s of supplements) {
      const dosages = await ctx.db
        .query("dosages")
        .withIndex("by_supplement", (q) => q.eq("supplementId", s._id))
        .collect();
      const bottles = await ctx.db
        .query("bottles")
        .withIndex("by_supplement", (q) => q.eq("supplementId", s._id))
        .collect();

      const rate = getConsumptionRate(dosages);
      const anchoredAt = s.anchoredAt ?? s.createdAt ?? Date.now();
      const { openCostPerPill } = getBottleStates(bottles, anchoredAt, rate);
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
        const perDay = getSpendRatePerDay(
          getDosageWeekly(d) / 7,
          openCostPerPill
        );
        perPersonDay.set(
          d.personId,
          (perPersonDay.get(d.personId) ?? 0) + perDay
        );
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
      household: {
        perDay: householdPerDay,
        perWeek: householdPerDay * 7,
        perMonth: householdPerDay * 30,
        lifetime: householdLifetime,
      },
    };
  },
});
