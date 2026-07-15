# Slice 01 — Basket math and nudge fixtures

## Contract unlocked

Pure, testable **all-in basket math** and **soft nudge** rules shared by Convex and the client. No schema or UI in this slice.

## API seam

**Module:** `lib/restock-basket-math.ts`

Export typed inputs/outputs and functions:

```ts
type BasketLineInput = {
  qty: number;
  enteredPrice: number | null;
  candidateCount: number | null;
};

type RetailerShippingConfig = {
  freeShippingThreshold?: number;
  standardShippingCost?: number;
};

// buildBasketLines, computeRetailerBasket, lowestPerPillCandidateIds,
// cheapestBasketRetailerIds — match ADR-0009 / ticket 02 rules
```

**Module:** `lib/retailer-accent.ts` — `retailerAccent(retailerId: string)` returning Tailwind class tokens (port from `components/prototype/two-pane-restock/retailer-colors.ts`).

## Scenarios (deterministic fixtures in `tests/restock-basket-math.test.cjs`)

- Subtotal sums priced lines only; unpriced → `"no price"` / null line total
- Applied shipping when threshold unset OR subtotal below threshold; $0 when met
- Shipping unknown when below threshold and no standard cost
- All-in = subtotal + applied shipping
- Gap to free shipping uses subtotal only
- Cheapest-basket nudge excludes incomplete and shipping-unknown baskets; ties return all winners
- Lowest-$/pill requires ≥2 candidates with price + count on same item
- $/pill never allocates shipping

## Human can run

```bash
npm test -- tests/restock-basket-math.test.cjs
```

## Verification

- [x] All scenarios above have tests; `npm test` green
- [x] `npx tsc --noEmit` green
- [x] No imports from Convex or React in `lib/restock-basket-math.ts`

## Must stay green

Existing `tests/supplement-utils.test.cjs`.

## Done when

Basket math is the single owner for totals/nudges; slice 05+ import this module instead of inlining math.
