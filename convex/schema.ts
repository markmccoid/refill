import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  households: defineTable({
    name: v.string(),
    createdAt: v.number(),
  }),

  people: defineTable({
    householdId: v.id("households"),
    name: v.string(),
    color: v.string(), // e.g., "green", "amber"
  })
    .index("by_household", ["householdId"]),

  supplements: defineTable({
    householdId: v.id("households"),
    name: v.string(),
    brand: v.optional(v.string()),
    form: v.optional(v.string()), // e.g., "Softgel", "Tablet"
    servingSize: v.optional(v.string()), // e.g., "1 softgel"
    servingSizeAmount: v.optional(v.number()), // e.g., 1000 (mg)
    servingSizeUnit: v.optional(v.string()), // e.g., "mg"
    nutrients: v.optional(v.array(v.object({
      name: v.string(),
      amount: v.number(),
      unit: v.string(),
    }))),
    category: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    jarSize: v.number(), // default bottle count; pre-fills the add-bottle form
    // Consumption model: on-hand is computed from this anchor, not stored live.
    // With the bottle ledger (ADR-0002) the truth is per-bottle remainingAtAnchor;
    // quantityAnchor is a synced cache (= Σ bottle.remainingAtAnchor).
    quantityAnchor: v.optional(v.number()), // total pills on hand at anchoredAt
    anchoredAt: v.optional(v.number()), // ms timestamp of the anchor
    remaining: v.optional(v.number()), // legacy: pre-anchor pill count
    price: v.optional(v.number()), // legacy: single per-bottle price (pre bottle ledger)
    purchaseUrl: v.optional(v.string()), // legacy: purchase link now lives per-bottle
    createdAt: v.number(),
  })
    .index("by_household", ["householdId"]),

  // A physical bottle purchase. FIFO ledger backing on-hand + cost (ADR-0002).
  bottles: defineTable({
    supplementId: v.id("supplements"),
    count: v.number(), // label capacity of this bottle
    price: v.number(), // what was paid for this bottle
    purchaseUrl: v.optional(v.string()), // where this bottle was bought (per-store)
    purchasedAt: v.number(), // ms; also the FIFO order key (oldest consumed first)
    // Pills in THIS bottle at the supplement's anchoredAt. Σ across bottles =
    // supplement.quantityAnchor. Consumption drains these oldest-first on read.
    remainingAtAnchor: v.number(),
  })
    .index("by_supplement", ["supplementId"]),

  supplementFacts: defineTable({
    supplementId: v.id("supplements"),
    dsldId: v.string(),
    fullName: v.string(),
    brandName: v.optional(v.string()),
    form: v.optional(v.string()),
    servingSize: v.optional(v.string()),
    servingsPerContainer: v.optional(v.number()),
    upcSku: v.optional(v.string()),
    offMarket: v.optional(v.boolean()),
    // Flattened supplement-facts panel, tuned for display & comparison.
    rows: v.array(
      v.object({
        name: v.string(),
        ingredientGroup: v.optional(v.string()),
        category: v.optional(v.string()),
        amount: v.optional(v.number()),
        unit: v.optional(v.string()),
        operator: v.optional(v.string()),
        dvPercent: v.optional(v.number()),
        dvFootnote: v.optional(v.string()),
        level: v.number(), // nesting depth (0 = top-level)
        isOther: v.boolean(),
      })
    ),
    otherIngredients: v.optional(v.string()),
    raw: v.string(), // frozen DSLD label JSON snapshot (stringified)
    thumbnailStorageId: v.optional(v.id("_storage")),
    pdfStorageId: v.optional(v.id("_storage")),
    fetchedAt: v.number(),
  })
    .index("by_supplement", ["supplementId"]),

  dosages: defineTable({
    supplementId: v.id("supplements"),
    personId: v.id("people"),
    pillsPerWeek: v.optional(v.number()), // canonical: total pills per week
    // Legacy fixed-schedule model (pre pills-per-week):
    pillsPerDose: v.optional(v.number()),
    daysPerWeek: v.optional(v.number()),
  })
    .index("by_supplement", ["supplementId"])
    .index("by_person", ["personId"]),

  retailerSites: defineTable({
    householdId: v.id("households"),
    name: v.string(),
    baseUrl: v.string(),
  })
    .index("by_household", ["householdId"]),

  priceQuotes: defineTable({
    supplementId: v.id("supplements"),
    retailerId: v.id("retailerSites"),
    sticker: v.number(),
    shipping: v.number(),
    total: v.number(),
    inStock: v.boolean(),
    etaDays: v.number(),
    checkedAt: v.number(),
  })
    .index("by_supplement", ["supplementId"])
    .index("by_retailer", ["retailerId"]),
});
