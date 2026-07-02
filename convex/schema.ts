import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Convex Auth tables (users, authAccounts, authSessions, …). Identity now
  // comes from a real signed-in user, not a localStorage demo id.
  ...authTables,

  households: defineTable({
    name: v.string(),
    createdAt: v.number(),
    // Restock knobs (ADR-0006). Missing => defaults (30 / 90) applied in code.
    forecastWindowDays: v.optional(v.number()), // urgency signalling only
    coverageTargetDays: v.optional(v.number()), // drives recommended quantity
  }),

  // Links users to households (many-to-many, multi-tenant ready). Today each
  // user has exactly one "owner" row; sharing later = insert a "member" row.
  householdMembers: defineTable({
    userId: v.id("users"),
    householdId: v.id("households"),
    role: v.union(v.literal("owner"), v.literal("member")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_household", ["householdId"]),

  people: defineTable({
    householdId: v.id("households"),
    name: v.string(),
    color: v.string(), // e.g., "green", "amber"
    // Lifecycle: missing => active (no migration for pre-existing rows).
    // Disabled people are paused — their dosages are kept but excluded from
    // consumption rate, forecasts, and costs. person.status is the single
    // source of truth. See docs/adr/0003.
    status: v.optional(v.union(v.literal("active"), v.literal("disabled"))),
    disabledAt: v.optional(v.number()), // ms; set when disabled, cleared on re-enable
  })
    .index("by_household", ["householdId"]),

  // An interchangeable set of supplement brands consumed one at a time in a
  // single pooled FIFO queue (ADR-0004). Owns the shared anchor clock; member
  // supplements' own anchoredAt/quantityAnchor become caches while grouped.
  groups: defineTable({
    householdId: v.id("households"),
    name: v.string(), // the role, e.g. "Fish Oil" — no member brand carries it
    category: v.optional(v.string()),
    anchoredAt: v.number(), // shared clock for the pooled consumption walk
    createdAt: v.number(),
  })
    .index("by_household", ["householdId"]),

  supplements: defineTable({
    householdId: v.id("households"),
    name: v.string(),
    // When set, this supplement is one brand within a Group (ADR-0004): its
    // stock deplete via the group's pooled FIFO queue, not on its own.
    groupId: v.optional(v.id("groups")),
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
    .index("by_household", ["householdId"])
    .index("by_group", ["groupId"]),

  // A physical bottle purchase. FIFO ledger backing on-hand + cost (ADR-0002).
  bottles: defineTable({
    supplementId: v.id("supplements"),
    count: v.number(), // label capacity of this bottle
    price: v.number(), // what was paid for this bottle
    purchaseUrl: v.optional(v.string()), // where this bottle was bought (per-store)
    retailerId: v.optional(v.id("retailers")), // which Retailer it came from (ADR-0006)
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

  // A store the household buys from (ADR-0006). First-class so saved links,
  // average prices, shipping thresholds, and never-yet-purchased-from stores
  // all have something to hang on. Managed inline; no delete in v1.
  retailers: defineTable({
    householdId: v.id("households"),
    name: v.string(),
    baseUrl: v.optional(v.string()),
    freeShippingThreshold: v.optional(v.number()), // unset ≠ $0: "we don't know"
    createdAt: v.number(),
  })
    .index("by_household", ["householdId"]),

  // Saved purchase link: the product URL you'd reopen to restock a supplement at
  // a retailer. One per (supplement, retailer); exists independently of bottles.
  savedLinks: defineTable({
    supplementId: v.id("supplements"),
    retailerId: v.id("retailers"),
    url: v.string(),
  })
    .index("by_supplement", ["supplementId"])
    .index("by_retailer", ["retailerId"]),

  // One line of the household's single active Restock Plan (ADR-0006). Subject
  // is what runs out — a solo supplement XOR a group. Entered prices are
  // session-scoped: they live (and die) with this row. Purchased rows are kept
  // as history; only "active" rows are the plan.
  restockItems: defineTable({
    householdId: v.id("households"),
    supplementId: v.optional(v.id("supplements")), // solo subject…
    groupId: v.optional(v.id("groups")), // …XOR group subject
    qty: v.number(), // planned bottles; pre-filled from the recommendation
    // The selected Offer = brand + retailer chosen together. For solo items
    // selectedSupplementId always equals supplementId.
    selectedSupplementId: v.optional(v.id("supplements")),
    selectedRetailerId: v.optional(v.id("retailers")),
    // Manually entered per-bottle sticker prices, keyed by (brand, retailer).
    enteredPrices: v.array(
      v.object({
        supplementId: v.id("supplements"),
        retailerId: v.id("retailers"),
        price: v.number(),
      })
    ),
    status: v.union(v.literal("active"), v.literal("purchased")),
    addedAt: v.number(),
    purchasedAt: v.optional(v.number()),
  })
    .index("by_household", ["householdId"])
    .index("by_household_status", ["householdId", "status"]),
});
