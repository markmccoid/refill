# Restock decision-support redesign

## Overview

Restock is a decision-support surface for comparing durable Candidate Products across retailers. It keeps product links independent from current inventory brands, shows retailer baskets with shipping-aware all-in totals, and requires an explicit inventory destination when a purchase is recorded.

The governing decision is [ADR-0009](../../../docs/adr/0009-restock-candidate-products-all-in-baskets.md). Domain language is in [`CONTEXT.md`](../../../CONTEXT.md).

## Why this shape

The former brand-by-retailer Offer matrix coupled shopping choices to brands already in inventory and grew combinatorially as either side expanded. Candidate Products instead belong to the solo supplement or group that needs restocking. Their URLs survive purchase cycles, while selection, quantity, and candidate-keyed entered prices remain cycle-scoped.

The feature supports decisions rather than optimizing them. Retailer assignment remains explicit, and soft cheapest-basket cues appear only when complete, comparable all-in totals exist. Tax, account-specific promotions, scraping, and automatic retailer assignment remain outside the model because the application cannot know them reliably.

Purchase completion deliberately does not infer a match from a candidate label. A candidate can represent a substitute or a brand never stocked before, so each included line must land on an allowed existing supplement or create a new one. New supplements can join the current group, or form a group with a solo subject when the user opts in.

## Invariants

- A Candidate Product belongs to exactly one restock subject and is unique by literal URL within that subject.
- Candidate URLs and metadata are durable; selected candidate, per-candidate sticker prices, and planned quantity live on the active restock item. Selection changes do not transfer prices.
- Basket math has one owner in `lib/restock-basket-math.ts`. Shipping is included in all-in totals when applicable, but never allocated into per-pill price.
- Incomplete or unknown-shipping baskets cannot receive a cheapest-all-in cue.
- Existing purchase destinations stay inside the item's subject: the solo supplement itself or a member of the current group.
- Every included purchase line requires an explicit destination and valid actual quantity, price, and count. Unchecked lines remain active on the plan.
- A completed purchase logs bottle rows with the candidate URL, refreshes the saved purchase link, and leaves the Candidate Product unchanged.

## Code pointers

- Candidate persistence and lifecycle: `convex/candidateProducts.ts`
- Saved-link migration and ongoing seeding: `convex/candidateSeeding.ts`
- Schema ownership: `convex/schema.ts` (`candidateProducts`, `restockItems`, retailer shipping fields)
- Plan projection, baskets, and purchase mutation: `convex/restock.ts` (`plan`, `markPurchased`)
- Shared basket rules: `lib/restock-basket-math.ts`
- Destination authorization rule: `lib/purchase-destination-utils.ts`
- Stable retailer accents: `lib/retailer-accent.ts`
- Decision UI: `app/(app)/restock/page.tsx`
- Candidate management: `components/restock/CandidateDrawer.tsx`
- Match-or-add UI: `components/restock/PurchaseDialog.tsx`
- Contract tests: `tests/restock-basket-math.test.cjs`, `tests/restock-plan-projection.test.cjs`, `tests/purchase-destination-utils.test.cjs`, `tests/purchase-actuals-utils.test.cjs`, `tests/candidate-product-utils.test.cjs`, and `tests/candidate-seeding-utils.test.cjs`

## Design provenance

The interaction and layout decisions were resolved in the closed design tickets under [`.scratch/restock-redesign/`](../../../.scratch/restock-redesign/):

- Candidate management uses the shared drawer model from ticket 03.
- The production Restock page uses ticket 04's Variant A hierarchy: item cards in the wider pane and sticky retailer baskets in the narrower pane, linked by retailer accents.
- The purchase dialog follows ticket 05's per-line resolution table: include control, required unselected Land-as choices, conditional add-new controls, and editable actuals.

The retained [`assets/slice-07/`](assets/slice-07/) captures document the candidate-management visual standard: `prototype-drawer-c.png` is the selected Variant C reference, while `drawer-empty.png`, `drawer-with-candidate.png`, `summary-card.png`, and `list.png` show the production result and its surrounding surfaces.

The temporary `/prototype/candidate-capture` and `/prototype/two-pane-restock` routes were implementation references, not durable product surfaces, and were removed after their selected variants were folded into production.

## Rejected paths

- **Offer matrix:** rejected because it tied shopping links to current brands and multiplied every brand by every retailer.
- **Automatic optimizer:** rejected because the user is comparing constraints the application does not fully know.
- **Average historical price fallback:** rejected for decisions because only the current sticker price is comparable in the active cycle.
- **Threshold-gap-only shipping:** rejected because it hid the real cost of an under-threshold basket.
- **Implicit purchase match:** rejected because labels and current group membership are not reliable identity evidence.
- **Bidirectional saved-link synchronization:** rejected; seeding is additive so later edits do not unexpectedly rewrite durable candidates.

## Verification record

On 2026-07-15, the full unit suite (57 tests), `npx tsc --noEmit`, and `npm run build` passed. Browser checks exercised two independently priced candidates, repeated switching, reload persistence, per-option $/pill and lowest-★ labels, selected basket totals, and purchase-dialog defaults. The earlier purchase flow checks covered empty and valid dialog states, add-new controls, and a confirmed existing-destination purchase that removed only the purchased line from the active plan. A fresh screenshot critique found no blocker for the focused per-candidate pricing behavior.

Production Convex was cut over in two validated stages: the compatibility deployment seeded 16 candidates across 17 subjects and cleared legacy fields from 3 Restock rows, then the final deployment removed the legacy schema and migration surface.

Per-candidate pricing completed its production cutover on 2026-07-15: backfill scanned 3, backfilled 1, and skipped 2 with no selection issues; clear scanned 3, cleared 1, found 2 already clear, and reported `skippedNotBackfilled: 0`. The final schema/functions deployment succeeded, and the repository now contains only candidate-keyed cycle pricing.
