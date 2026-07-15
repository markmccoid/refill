---
label: wayfinder:grilling
status: closed
assignee: cursor
parent: ../MAP.md
blocked_by: []
---

# Formalize Candidate Product domain language

## Question

What exact glossary definition and relationships should **Candidate Product** have in `CONTEXT.md` — attachment to a restock **subject** (solo Supplement or Group), required fields (Retailer, URL, label, count), replacement of the Restock **Offer** / saved-link shopping surface, and which edge cases (group dissolve, subject delete, duplicate URLs) need explicit rules before UX tickets proceed?

## Resolution

**Answer:** `CONTEXT.md` now defines **Candidate Product**, retires **Offer**, and updates **Restock Plan**, **Restock item**, and **Saved purchase link**.

- **Attachment:** durable on subject (solo Supplement or Group), not on Restock item or grouped brand.
- **Semantics:** substitutes allowed (including brands not in inventory); different brand at purchase → new Supplement; always offer Group formation, user decides.
- **Fields:** Retailer, URL, label (required), count (required for $/pill nudges, not to save/select).
- **Identity:** one candidate per URL per subject (literal match); edit in place.
- **Lifecycle:** delete with subject; survive Restock item removal; migrate to survivor on Group auto-dissolve (dedupe); delete on full Group teardown.
- **Offer retired;** Saved purchase link kept as separate seed source. Selection, entered price, planned qty cycle-scoped on Restock item.

**Asset:** [CONTEXT.md](../../../CONTEXT.md) (Restocking section)
