# Slice 05 — Inventory outlook and nutrient report integration

## Contract unlocked

Add the operational report card and move the current nutrient report behind the card-based overview without changing its nutrient math.

## Inventory/run-out report

Show one row per solo supplement or group:

- on hand;
- effective pills/day;
- days remaining;
- projected run-out date;
- open bottle/brand;
- incoming bottle count/date;
- current monthly cost;
- urgency status.

Reuse the existing dashboard/restock derivation and group FIFO semantics. Do not create a second run-out algorithm in the Insights UI.

## Nutrient report integration

- Preserve current Daily Value and no-DV behavior.
- Open only when the user selects the nutrient card.
- Keep warnings for missing facts, grouped open-brand facts, and informational/non-medical use.
- Ensure returning from a report returns to the overview unless deep-link behavior is deliberately added and tested.

## Likely files

- `convex/insights.ts`
- `convex/restock.ts` and/or existing utility functions, only through a shared owner rather than copied logic
- `components/insights/*`
- `app/(app)/insights/page.tsx`

## Verification

- Compare inventory rows against Dashboard and Restock calculations for the same fixture data.
- Assert grouped subjects appear once.
- Browser-check no bottles, no rate, run-out within seven days, incoming bottles, and missing nutrient facts.
- Run `npm test` and `npm run build`.
- Screenshot-critique the report card/overview integration; if comparing against the prior Insights page, use a screenshot comparison to judge whether the new hierarchy is less confusing, not pixel-identical.

## Done when

Insights contains the useful operational view and the nutrient report remains available without dominating the landing page.

