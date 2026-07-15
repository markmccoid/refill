# Slice 08 — Restock two-pane UI

## Contract unlocked

Replace Offer table with **Variant A** layout: item cards (selected row + chips) + sticky retailer baskets with all-in totals and accents.

## API seam

**Refactor** `app/(app)/restock/page.tsx`:

- Remove `OfferRow`, offer table, average $/pill
- **ItemCard:** header, qty, selected row (label, retailer, Check Site, price input, $/pill), retailer chips with lowest ★, Manage options → `CandidateDrawer`
- **BasketCard:** lines, subtotal, shipping, all-in, gap/met, cheapest-all-in badge, Mark as Purchased (opens dialog stub ok until slice 09)
- **Retailer accent:** `lib/retailer-accent.ts` on basket border, selected chip, selected row
- Optional cheapest-all-in banner when ≥2 eligible baskets
- Import basket math from `lib/restock-basket-math.ts` only

**Keep unchanged:** header, picker modal, settings knobs, retailer add.

## Reference

- Prototype: `/prototype/two-pane-restock?variant=A`
- ADR-0009 + ticket 04 resolution

## Human can run

`npm run dev` → `/restock` with plan items → select chips, enter prices, see baskets update all-in.

## Verification

- [ ] No offer table or avg price UI
- [ ] Incomplete basket excluded from cheapest badge
- [ ] Shipping unknown state shown
- [ ] Per-retailer color links item to basket
- [ ] `npx tsc --noEmit` green
- [ ] **Visual gate:** screenshot-critique on full Restock page with 2+ items and 2+ retailers
- [ ] **Compare gate:** compare-screenshots vs prototype Variant A — crop: main two-pane grid; header/knob differences out of scope

## Depends on

Slices 05, 07.

## Done when

Restock decision UI matches ADR-0009 layout; purchase flow is the only major missing piece.

## Human review checkpoint (non-blocking)

preview-shots on Restock with mock plan; proceed if silent after ~5 min.
