---
label: wayfinder:task
status: closed
assignee: cursor
parent: ../MAP.md
blocked_by:
  - 02-define-all-in-basket-math.md
  - 04-two-pane-restock-decision-ui.md
  - 05-purchase-match-or-add-flow.md
  - 06-saved-link-seeding-rules.md
---

# Write the Restock redesign ADR

## Question

What ADR (superseding ADR-0006 where this redesign reverses or replaces it) records the locked Restock decision-support design — candidate products, all-in shipping, match-or-add purchase, and UI shape — so an implementation effort can start without re-litigating these decisions?

## Resolution

**Answer:** [ADR-0009: Restock decision support — candidate products, all-in baskets, match-or-add purchase](../../../docs/adr/0009-restock-candidate-products-all-in-baskets.md)

Consolidates wayfinder tickets 01–06. Supersedes ADR-0006 on Offer matrix, average $/pill, gap-only shipping, and implicit brand at purchase. Preserves ADR-0006 manual pricing, curated plan, Retailer entity, derived orders, session-scoped prices, and household knobs.

**Asset:** `docs/adr/0009-restock-candidate-products-all-in-baskets.md` · Implementation spec: `specs/restock-redesign/README.md`
