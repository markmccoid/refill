---
label: wayfinder:map
status: closed
---

# Restock decision-support redesign

## Destination

A revised Restock **design** (decisions + UX/functionality, ready to hand off — not the build) for **decision support** on multi-retailer purchasing: **candidate products** with durable links (not locked to current inventory brands), manual prices, optional **shipping cost** when under a free-shipping threshold so all-in retailer totals compare honestly, and purchase completion that lets the user **choose** existing vs new Supplement.

## Notes

- Domain: household supplement inventory (see root `CONTEXT.md`); current shipped behavior is ADR-0006 — this map is finding the design that will supersede the clunky parts.
- Skills every session should consult: `/grilling`, `/domain-modeling`, and for UI tickets `/prototype`. Prefer `/write-spec` only after this map’s design ADR ticket closes.
- Tracker: local markdown under `.scratch/restock-redesign/`. Map = this file. Tickets = `issues/<NN>-*.md`. Claim = set `assignee` in frontmatter. Blocking = `blocked_by` list of ticket filenames. Frontier = open, unassigned, empty `blocked_by` (or all blockers closed).
- Already locked in charting (detail lives here until tickets refine edge cases): decision support not optimizer; two-pane UI (candidates per item + retailer baskets); many candidates / one selected; candidates on subject; replace offer matrix; keep plan membership/forecast/coverage; soft nudges only; candidate fields Retailer+URL+label+count; durable candidates, cycle-scoped prices/selection; standard shipping cost stored on Retailer; Mark as Purchased is match-or-add with no auto-guess.

## Decisions so far

<!-- the index — one line per closed ticket -->

- [Formalize Candidate Product domain language](issues/01-formalize-candidate-product-domain.md) — Candidate Product durable on subject; substitutes allowed; Offer retired; lifecycle rules for dissolve/delete/dedupe locked in `CONTEXT.md`
- [Define all-in retailer basket math](issues/02-define-all-in-basket-math.md) — Stored standard shipping cost on Retailer; all-in = subtotal + applied shipping; sticker-only $/pill; incomplete/unknown-shipping baskets excluded from cheapest-basket nudge; gap on subtotal only
- [Design candidate capture and management UX](issues/03-candidate-capture-and-management-ux.md) — Shared drawer CRUD from subject + Restock; summary card on subject; selected+chips on Restock item; inline add/edit; confirm-delete if in use; duplicate URL → edit existing
- [Design the two-pane Restock decision UI](issues/04-two-pane-restock-decision-ui.md) — Variant A: 2/3 item cards (selected row + chips) + 1/3 sticky retailer baskets with subtotal/shipping/all-in, soft nudges, cheapest-all-in badge, per-retailer color accent linking items to baskets; offer grid retired
- [Design Mark as Purchased match-or-add flow](issues/05-purchase-match-or-add-flow.md) — Per-retailer modal; required Land-as radios (subject-scoped, no default); add-new with editable label name; solo group-formation checkbox; group add-new auto-joins; plan pre-fills actuals; candidate URL → bottle + saved link; include checkbox keeps unchecked lines on plan
- [Decide saved-link seeding rules](issues/06-saved-link-seeding-rules.md) — Hybrid: silent one-time migration + ongoing auto-add on new/changed URLs; bottle-URL fallback; group aggregates all members; label/count from supplement + bottle history; manual Import in drawer with preview; no sync/delete
- [Write the Restock redesign ADR](issues/07-write-restock-redesign-adr.md) — [ADR-0009](../../docs/adr/0009-restock-candidate-products-all-in-baskets.md) consolidates tickets 01–06; supersedes ADR-0006 Offer/all-in/match-or-add conflicts; ready for implementation handoff

## Not yet specified

- Whether / how historical average bottle prices surface when a candidate overlaps past purchases
- Optional notes field on candidates
- Visual treatment and motion beyond the two-pane structure
- Exact Check Site / multi-tab price-entry workflow polish

## Out of scope

- Price scraping or automated quote fetching (rejected in ADR-0006; stays rejected)
- Optimizer / auto-assigning items across retailers
- Tax modeling
- Subscribe-and-save / account-specific promo modeling beyond what the user types as price
- Rebuilding plan membership, urgency badge, or coverage-target knobs (kept as today)
