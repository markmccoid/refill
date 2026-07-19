import { query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireMembership } from "./authz";
import {
  classifyDosagesWithPeople,
  loadHouseholdLedger,
} from "./consumption";
import {
  getConsumptionRate,
  getDosageWeekly,
  getGroupRate,
} from "../lib/supplement-utils";
import { bottleDoc } from "./bottles";

const nutrientsValidator = v.array(
  v.object({
    name: v.string(),
    amount: v.number(),
    unit: v.string(),
  })
);

const supplementDoc = v.object({
  _id: v.id("supplements"),
  _creationTime: v.number(),
  householdId: v.id("households"),
  name: v.string(),
  groupId: v.optional(v.id("groups")),
  brand: v.optional(v.string()),
  form: v.optional(v.string()),
  servingSize: v.optional(v.string()),
  servingSizeAmount: v.optional(v.number()),
  servingSizeUnit: v.optional(v.string()),
  nutrients: v.optional(nutrientsValidator),
  category: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  iconId: v.optional(v.string()),
  jarSize: v.number(),
  quantityAnchor: v.optional(v.number()),
  anchoredAt: v.optional(v.number()),
  remaining: v.optional(v.number()),
  price: v.optional(v.number()),
  purchaseUrl: v.optional(v.string()),
  createdAt: v.number(),
  cachedOnHand: v.optional(v.number()),
  cachedIncomingCount: v.optional(v.number()),
  cachedRatePerDay: v.optional(v.number()),
  forecastCachedAt: v.optional(v.number()),
});

const dosageDoc = v.object({
  _id: v.id("dosages"),
  _creationTime: v.number(),
  householdId: v.optional(v.id("households")),
  supplementId: v.id("supplements"),
  personId: v.id("people"),
  pillsPerWeek: v.optional(v.number()),
  pausedAt: v.optional(v.number()),
  pauseUntil: v.optional(v.number()),
  pillsPerDose: v.optional(v.number()),
  daysPerWeek: v.optional(v.number()),
});

/**
 * Single household inventory read for Dashboard + Supplements pages.
 * Assembles solo supplements and groups once (no double bottle/dosage reads).
 */
export const listForHousehold = query({
  args: { householdId: v.id("households") },
  returns: v.object({
    solos: v.array(
      v.object({
        ...supplementDoc.fields,
        consumptionRate: v.number(),
        bottles: v.array(bottleDoc),
        dosages: v.array(dosageDoc),
      })
    ),
    groups: v.array(
      v.object({
        _id: v.id("groups"),
        _creationTime: v.number(),
        householdId: v.id("households"),
        name: v.string(),
        category: v.optional(v.string()),
        anchoredAt: v.number(),
        createdAt: v.number(),
        cachedOnHand: v.optional(v.number()),
        cachedIncomingCount: v.optional(v.number()),
        cachedRatePerDay: v.optional(v.number()),
        forecastCachedAt: v.optional(v.number()),
        members: v.array(
          v.object({
            supplement: supplementDoc,
            bottles: v.array(bottleDoc),
          })
        ),
        takers: v.array(
          v.object({
            personId: v.id("people"),
            pillsPerWeek: v.number(),
          })
        ),
        dosages: v.array(dosageDoc),
        consumptionRate: v.number(),
      })
    ),
  }),
  async handler(ctx, { householdId }) {
    await requireMembership(ctx, householdId);
    const ledger = await loadHouseholdLedger(ctx, householdId);
    const now = Date.now();

    const solos = ledger.supplements
      .filter((s) => !s.groupId)
      .map((s) => {
        const classified = classifyDosagesWithPeople(
          ledger.dosagesBySupplement.get(s._id) ?? [],
          ledger.peopleById,
          now
        );
        return {
          ...s,
          consumptionRate: getConsumptionRate(classified.activeForRate, now),
          bottles: ledger.bottlesBySupplement.get(s._id) ?? [],
          dosages: classified.personActive,
        };
      });

    const groups = ledger.groups.map((g) => {
      const members = ledger.supplements.filter((s) => s.groupId === g._id);
      const memberData = members.map((m) => ({
        supplement: m,
        bottles: ledger.bottlesBySupplement.get(m._id) ?? [],
      }));

      const weeklies: { personId: string; weekly: number }[] = [];
      const dosages = [];
      const takerWeekly = new Map<string, number>();
      for (const m of members) {
        const classified = classifyDosagesWithPeople(
          ledger.dosagesBySupplement.get(m._id) ?? [],
          ledger.peopleById,
          now
        );
        dosages.push(...classified.personActive);
        for (const d of classified.activeForRate) {
          weeklies.push({ personId: d.personId, weekly: getDosageWeekly(d) });
        }
        for (const d of classified.all) {
          const w = getDosageWeekly(d);
          takerWeekly.set(
            d.personId,
            Math.max(takerWeekly.get(d.personId) ?? 0, w)
          );
        }
      }

      const takers = [...takerWeekly.entries()].map(
        ([personId, pillsPerWeek]) => ({
          personId: personId as Id<"people">,
          pillsPerWeek,
        })
      );

      return {
        ...g,
        members: memberData,
        takers,
        dosages,
        consumptionRate: getGroupRate(weeklies),
      };
    });

    return { solos, groups };
  },
});
