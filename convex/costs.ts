import { query } from "./_generated/server";
import { v } from "convex/values";
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
import {
  classifyDosagesWithPeople,
  loadHouseholdLedger,
} from "./consumption";

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
    const ledger = await loadHouseholdLedger(ctx, householdId);
    const people = [...ledger.peopleById.values()].filter(
      (p): p is NonNullable<typeof p> => !!p && p.status !== "disabled"
    );
    const activePersonIds = new Set(people.map((p) => p._id));
    const now = Date.now();

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

    for (const s of ledger.supplements.filter((x) => !x.groupId)) {
      const classified = classifyDosagesWithPeople(
        ledger.dosagesBySupplement.get(s._id) ?? [],
        ledger.peopleById,
        now
      );
      const dosages = classified.personActive.filter((d) =>
        activePersonIds.has(d.personId)
      );
      const bottles = ledger.bottlesBySupplement.get(s._id) ?? [];

      const rate = getConsumptionRate(dosages, now);
      const anchoredAt = s.anchoredAt ?? s.createdAt ?? now;
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

    for (const g of ledger.groups) {
      const members = ledger.supplements.filter((s) => s.groupId === g._id);

      const perPersonWeekly = new Map<string, number>();
      const memberDosages = [];
      const memberBottles = [];
      let lifetime = 0;
      for (const m of members) {
        const bottles = ledger.bottlesBySupplement.get(m._id) ?? [];
        memberBottles.push({ supplementId: m._id, bottles });
        lifetime += getLifetimeSpent(bottles);
        const classified = classifyDosagesWithPeople(
          ledger.dosagesBySupplement.get(m._id) ?? [],
          ledger.peopleById,
          now
        );
        const dosages = classified.personActive.filter((d) =>
          activePersonIds.has(d.personId)
        );
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
      perPersonSupplement: perPersonSupplement.sort(
        (a, b) => b.perMonth - a.perMonth
      ),
      household: {
        perDay: householdPerDay,
        perWeek: householdPerDay * 7,
        perMonth: householdPerDay * 30,
        lifetime: householdLifetime,
      },
    };
  },
});
