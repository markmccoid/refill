# Restock redesign (candidate products)

## Next Agent Prompt

You are implementing the Restock decision-support redesign in Refill. **Read this README, [ADR-0009](../../docs/adr/0009-restock-candidate-products-all-in-baskets.md), and the slice file for your pickup point before changing code.**

Implement slices **in order**. Each slice must leave a runnable artifact and pass its verification gates before the next slice starts. Do not re-litigate decisions locked in ADR-0009 or `.scratch/restock-redesign/`.

**Status:** Slices 01–07 complete; slice 08 UI rewritten (visual gates open). 2026-07-14.

**Next pickup:** Finish [Slice 08](slices/08-restock-two-pane-ui.md) visual/compare gates, then [Slice 09](slices/09-purchase-dialog-cleanup-qa.md).

**Blockers:** None. Note: slices 01–06 backend files remain uncommitted on this branch alongside slice 08 WIP — commit them before/with 08.

### Global checklist

- [x] 01 — Pure basket math, nudges, retailer accent (`lib/`)
- [x] 02 — Schema + `candidateProducts` Convex module
- [x] 03 — Retailer standard shipping cost
- [x] 04 — Saved-link seeding (migration, ongoing, import preview)
- [x] 05 — Restock plan backend (replace Offer projection)
- [x] 06 — `markPurchased` match-or-add backend
- [x] 07 — Shared candidate drawer + subject summary card
- [ ] 08 — Restock page two-pane UI (Variant A) — **code in tree; visual gates open**
- [ ] 09 — Purchase dialog match-or-add + legacy removal + final QA

### Evidence from current pass

**07 (committed `74ebb4d`):** CandidateDrawer + CandidateSummaryCard; solo + group surfaces; duplicate URL blocked; assets in `assets/slice-07/`
**08 (WIP, uncommitted):** Restock page ItemCard = selected row + retailer chips + Manage→CandidateDrawer; BasketCard = accents + shipping/all-in; plan items expose `supplementId`/`groupId`; `tsc` green. Still need screenshot-critique + compare vs Variant A with 2+ items/retailers.

**Before ending your pass:** update this section with status, evidence (commands run, files touched), and the next pickup slice.

---

## Goal

Replace ADR-0006's brand×retailer **Offer matrix** with **Candidate Products**, **all-in retailer basket totals**, and **match-or-add** purchase completion — per [ADR-0009](../../docs/adr/0009-restock-candidate-products-all-in-baskets.md).

The human should be able to compare multi-retailer restock options honestly (shipping included), manage durable product links on subjects, and land purchases on existing or new Supplements without the system guessing matches.

## Source of truth (do not re-debate)

| Doc | Role |
|-----|------|
| [ADR-0009](../../docs/adr/0009-restock-candidate-products-all-in-baskets.md) | Implementation contract |
| [CONTEXT.md](../../CONTEXT.md) | Domain glossary |
| [.scratch/restock-redesign/MAP.md](../../.scratch/restock-redesign/MAP.md) | Closed design tickets 01–07 |
| `/prototype/candidate-capture?variant=C` | Candidate drawer UX reference |
| `/prototype/two-pane-restock?variant=A` | Restock layout reference (incl. retailer color accents) |

## End-state architecture (single owners)

| Concept | Owner | Notes |
|---------|-------|-------|
| Basket / nudge math | `lib/restock-basket-math.ts` | Pure functions; Convex + client import this — no duplicated totals logic |
| Retailer color accent | `lib/retailer-accent.ts` | Stable hue from retailer id; UI only |
| Candidate persistence | `convex/candidateProducts.ts` | CRUD, list-by-subject, URL dedupe, lifecycle helpers |
| Seeding rules | `convex/candidateSeeding.ts` | Migration, ongoing auto-add, import preview/add — calls candidateProducts only |
| Restock plan projection | `convex/restock.ts` | `plan` query + item mutations; **no Offer matrix** |
| Match-or-add purchase | `convex/restock.ts` `markPurchased` | Creates/matches supplements, logs bottles, writes URLs |
| Candidate drawer UI | `components/restock/CandidateDrawer.tsx` | Shared from subject page + Restock item |
| Restock page layout | `app/(app)/restock/page.tsx` + `components/restock/*` | Two-pane Variant A |

**Remove by slice 09:** `offerValidator`, `selectOffer`, `enteredPrices[]` array keyed by brand×retailer, Offer table UI, average-price $/pill fallback.

**Transitional seam (slice 05 only, if needed):** dual-read old `selectedSupplementId`/`selectedRetailerId` during migration cutover — **must be deleted in slice 09** once all active plan rows use `selectedCandidateId`.

## Slice graph

```text
01 basket math (pure)
 └─> 02 candidates schema + CRUD
      └─> 03 retailer shipping cost
           └─> 04 seeding
                └─> 05 restock plan backend
                     └─> 06 markPurchased backend
                          └─> 07 candidate drawer UI
                               └─> 08 restock two-pane UI
                                    └─> 09 purchase dialog + cleanup + QA
```

## Scope firewall

**In scope:** schema migration, Convex modules above, Restock + subject surfaces, Retailer dialog shipping field, silent seed migration, unit tests, prototype promotion/removal where replaced.

**Out of scope (ADR-0009):** price scraping, retailer optimizer, tax, subscribe-and-save modeling, rebuilding plan picker/urgency/coverage knobs, historical average price on candidates, candidate notes field, motion polish, Check Site multi-tab workflow.

**Deferred polish** (later spec or slice add-on): average price hint on candidates, optional notes, animation.

## Verification baseline

- Unit tests: `npm test`
- Types: `npx tsc --noEmit`
- Full build: `npm run build` (requires Convex codegen network)
- Dev smoke: `npm run dev` → `/restock`, subject detail, `/prototype/*` until prototypes are retired in slice 09
- Visual slices (07–09): run **screenshot-critique** on captures before accepting; use **compare-screenshots** against prototype baselines where listed in slice files

## Review map

- **Product:** match-or-add never pre-selects; seeding silent; drawer reachable from both surfaces
- **Data:** one candidate per URL per subject; group dissolve migrates candidates; seeding never syncs label/count on link edit
- **Visual:** Variant A layout, per-retailer accent on basket + chip + selected row

## Known unknowns (resolve in slice, not upfront)

- Exact Convex migration for in-flight `restockItems` with Offer selections → map to candidate or clear selection (slice 05)
- ~~Group detail page route if subject card lives only on supplement page today~~ → resolved in slice 07: no group detail route; card on expanded `GroupListItem`

## References

- Shipped Offer implementation: `convex/restock.ts`, `app/(app)/restock/page.tsx`, `components/restock/PurchaseDialog.tsx`
- Throwaway prototypes to fold in: `components/prototype/candidate-capture/`, `components/prototype/two-pane-restock/`
