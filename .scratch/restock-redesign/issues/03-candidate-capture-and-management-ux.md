---
label: wayfinder:prototype
status: closed
assignee: cursor
parent: ../MAP.md
blocked_by:
  - 01-formalize-candidate-product-domain.md
---

# Design candidate capture and management UX

## Question

How should a user add, edit, remove, and browse **candidate products** on a subject so product links are easy to surface and reuse across restock cycles — without rebuilding the old brand×retailer matrix?

## Resolution

**Answer:** One **shared drawer** for all candidate CRUD, reachable from the subject page and from each Restock item. Restock selection stays on the item card; the library stays durable on the subject.

| Surface | Behavior |
|---------|----------|
| **Subject page** | Summary card: count + short preview (2–3 labels), **Manage** opens drawer |
| **Restock item (drawer closed)** | **Selected + chips** — selected row (label, retailer, Check Site, cycle price); retailer chips for quick-switch; **Manage options** opens drawer |
| **Drawer** | Context banner (opened from subject vs restock). List all candidates; **+ Add option** expands inline form at bottom; **Edit** inline-expands row; delete one-tap if unused, confirm if selected on active Restock item (clears selection) |
| **Duplicate URL** | Block add; offer to edit existing row (scroll + expand) |
| **Empty state** | Restock-first nudge — empty copy on both surfaces; drawer opens with add form expanded. No seed hints here (ticket 06) |
| **Retailer field** | Household retailer dropdown + existing Add retailer dialog; URL paste may suggest retailer but dropdown is source of truth |

**Asset:** Prototype route `/prototype/candidate-capture?variant=C` (Variant C base; A/B kept for comparison during review)
