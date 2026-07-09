import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  getConsumptionRate,
  getOnHand,
  getBottleBreakdown,
} from "../lib/supplement-utils";

/**
 * One-time backfill to the consumption model. Idempotent — safe to re-run.
 * - supplements: seed quantityAnchor from legacy `remaining`, anchoredAt from
 *   createdAt (so existing depletion is honoured).
 * - dosages: seed pillsPerWeek from legacy pillsPerDose × daysPerWeek.
 */
export const backfillConsumption = internalMutation({
  args: {},
  returns: v.object({ supplements: v.number(), dosages: v.number() }),
  async handler(ctx) {
    let supplements = 0;
    for (const s of await ctx.db.query("supplements").collect()) {
      if (s.quantityAnchor === undefined) {
        await ctx.db.patch(s._id, {
          quantityAnchor: s.remaining ?? s.jarSize,
          anchoredAt: s.anchoredAt ?? s.createdAt ?? Date.now(),
        });
        supplements++;
      }
    }

    let dosages = 0;
    for (const d of await ctx.db.query("dosages").collect()) {
      if (d.pillsPerWeek === undefined) {
        await ctx.db.patch(d._id, {
          pillsPerWeek: (d.pillsPerDose ?? 0) * (d.daysPerWeek ?? 0),
        });
        dosages++;
      }
    }

    return { supplements, dosages };
  },
});

/**
 * One-time backfill to the bottle ledger (ADR-0002). Idempotent — skips any
 * supplement that already has bottles. Materializes current derived stock into
 * bottles at the supplement's existing single `price`, and re-anchors to now so
 * the per-bottle snapshot is exact. Supplements with nothing on hand get no
 * bottles.
 */
export const backfillBottles = internalMutation({
  args: {},
  returns: v.object({ migrated: v.number(), created: v.number() }),
  async handler(ctx) {
    let created = 0; // bottles created
    let migrated = 0; // supplements touched

    for (const s of await ctx.db.query("supplements").collect()) {
      const existing = await ctx.db
        .query("bottles")
        .withIndex("by_supplement", (q) => q.eq("supplementId", s._id))
        .collect();
      if (existing.length > 0) continue;

      const dosages = await ctx.db
        .query("dosages")
        .withIndex("by_supplement", (q) => q.eq("supplementId", s._id))
        .collect();
      const rate = getConsumptionRate(dosages);
      const onHand = Math.round(getOnHand(s, rate));
      if (onHand <= 0) continue;

      const breakdown = getBottleBreakdown(onHand, s.jarSize);
      const price = s.price ?? 0;
      const now = Date.now();

      // Open bottle first (oldest), then full sealed spares.
      await ctx.db.insert("bottles", {
        supplementId: s._id,
        count: s.jarSize,
        price,
        purchasedAt: now,
        remainingAtAnchor: breakdown.openRemaining,
      });
      created++;
      for (let i = 0; i < breakdown.sealedSpares; i++) {
        await ctx.db.insert("bottles", {
          supplementId: s._id,
          count: s.jarSize,
          price,
          purchasedAt: now + i + 1,
          remainingAtAnchor: s.jarSize,
        });
        created++;
      }

      await ctx.db.patch(s._id, { quantityAnchor: onHand, anchoredAt: now });
      migrated++;
    }

    return { migrated, created };
  },
});

/**
 * Backfill `source` on supplementFacts (ADR-0007-era facts editing). Every
 * pre-existing facts record came from a DSLD import. Idempotent.
 */
export const backfillFactsSource = internalMutation({
  args: {},
  returns: v.object({ updated: v.number() }),
  async handler(ctx) {
    let updated = 0;
    for (const f of await ctx.db.query("supplementFacts").collect()) {
      if (f.source === undefined) {
        await ctx.db.patch(f._id, { source: "dsld", edited: false });
        updated++;
      }
    }
    return { updated };
  },
});

/**
 * Move the legacy supplement-level `purchaseUrl` onto its bottles (purchase
 * links are now per-bottle). Idempotent — only fills bottles that lack a URL.
 */
export const backfillBottlePurchaseUrls = internalMutation({
  args: {},
  returns: v.object({ updated: v.number() }),
  async handler(ctx) {
    let updated = 0;
    for (const s of await ctx.db.query("supplements").collect()) {
      if (!s.purchaseUrl) continue;
      const bottles = await ctx.db
        .query("bottles")
        .withIndex("by_supplement", (q) => q.eq("supplementId", s._id))
        .collect();
      for (const b of bottles) {
        if (!b.purchaseUrl) {
          await ctx.db.patch(b._id, { purchaseUrl: s.purchaseUrl });
          updated++;
        }
      }
    }
    return { updated };
  },
});

/**
 * Baseline existing dosages for future usage reports. This does not claim a
 * historical start date; it records the regimen known at migration time.
 */
export const backfillDosageEvents = internalMutation({
  args: {},
  returns: v.object({ created: v.number() }),
  async handler(ctx) {
    let created = 0;
    const now = Date.now();
    for (const d of await ctx.db.query("dosages").collect()) {
      const existing = await ctx.db
        .query("dosageEvents")
        .withIndex("by_dosage", (q) => q.eq("dosageId", d._id))
        .collect();
      if (existing.some((e) => e.type === "baseline")) continue;

      const supplement = await ctx.db.get(d.supplementId);
      if (!supplement) continue;
      await ctx.db.insert("dosageEvents", {
        householdId: supplement.householdId,
        dosageId: d._id,
        supplementId: d.supplementId,
        personId: d.personId,
        type: "baseline",
        occurredAt: now,
        nextPillsPerWeek: (d.pillsPerWeek ?? 0) || (d.pillsPerDose ?? 0) * (d.daysPerWeek ?? 0),
        pauseStartedAt: d.pausedAt,
        pauseUntil: d.pauseUntil,
      });
      created++;
    }
    return { created };
  },
});
