# Slice 02 — Candidate Products schema and CRUD

## Contract unlocked

Persist **Candidate Products** on restock subjects with Convex mutations/queries. No Restock page changes yet.

## API seam

**Schema** (`convex/schema.ts`):

```ts
candidateProducts: defineTable({
  householdId: v.id("households"),
  supplementId: v.optional(v.id("supplements")), // solo subject XOR…
  groupId: v.optional(v.id("groups")),           // …group subject
  retailerId: v.id("retailers"),
  url: v.string(),
  label: v.string(),
  count: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_supplement", ["supplementId"])
  .index("by_group", ["groupId"])
  .index("by_household", ["householdId"]);
```

**Module:** `convex/candidateProducts.ts`

| Function | Behavior |
|----------|----------|
| `listBySubject` | Candidates for solo supplement or group id |
| `create` | Validate label + url + retailer; reject duplicate URL on subject (literal match) |
| `update` | Edit label, url, count, retailer; URL change respects dedupe |
| `remove` | Delete; caller handles "selected on active plan" warning in UI layer |

Auth: household membership via subject.

## Lifecycle hooks (document only — wire in slice 06/09)

- Delete with subject teardown
- Group auto-dissolve → migrate to survivor supplement, dedupe URL
- Full group delete → delete group candidates

## Human can run

Convex dashboard or a minimal dev-only probe mutation to list/create candidates on a test subject.

## Verification

- [x] `npx tsc --noEmit` green
- [x] Unit tests for URL dedupe and XOR subject constraint (`lib/candidate-product-utils.ts` + `tests/candidate-product-utils.test.cjs`)
- [x] `convex codegen` succeeds

## Depends on

Slice 01 (optional — no hard dependency).

## Done when

Candidates can be stored and listed per subject independent of Restock plan rows.
