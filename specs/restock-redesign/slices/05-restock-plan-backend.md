# Slice 05 — Restock plan backend (replace Offer)

## Contract unlocked

`api.restock.plan` and item mutations speak **Candidate Products**, not Offers. This is the core backend cutover.

## Schema changes (`restockItems`)

**Add:**

- `selectedCandidateId: v.optional(v.id("candidateProducts"))`
- `enteredPrice: v.optional(v.number())` — single cycle-scoped price for selected candidate

**Remove (after migration in this slice):**

- `selectedSupplementId`, `selectedRetailerId`
- `enteredPrices[]` array

## API seam (`convex/restock.ts`)

**`plan` query returns per item:**

- Subject metadata (unchanged spirit)
- `candidates[]` from `candidateProducts.listBySubject`
- `selectedCandidateId`, `enteredPrice`, `qty`, `recommendedQty` (uses selected candidate count)
- Derived `retailerOrders[]` or client-side grouping using slice 01 math — pick one owner; prefer **server-side basket summary** in query for consistency

**Mutations:**

| Mutation | Replaces |
|----------|----------|
| `selectCandidate` | `selectOffer` — set/clear selectedCandidateId |
| `setPrice` | per-offer setPrice — single enteredPrice on item |
| `setQty` | unchanged |

**Remove:** offer matrix builder, `offerValidator`, average price in projection.

## Cutover migration

For each active `restockItem` with `selectedSupplementId` + `selectedRetailerId`:

- Find or create matching candidate (saved link URL + retailer) on subject
- Set `selectedCandidateId` + migrate entered price from array entry

If no URL exists, clear selection.

## Human can run

Convex dashboard / temporary dev page: `plan` shows candidates not offers.

## Verification

- [x] `npx tsc --noEmit` green
- [x] No `offers` in plan return type (`grep` codebase)
- [x] Recommended qty uses candidate count
- [x] Group items still use group as subject
- [x] Unit test: plan projection fixture with 2 candidates, 1 selected, basket subtotal correct via shared math

## Depends on

Slices 01–04.

## Done when

Backend no longer generates brand×retailer matrix; Restock UI can be wired without Offer types.
