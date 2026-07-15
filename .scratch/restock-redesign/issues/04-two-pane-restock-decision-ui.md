---
label: wayfinder:prototype
status: closed
assignee: cursor
parent: ../MAP.md
blocked_by:
  - 01-formalize-candidate-product-domain.md
  - 02-define-all-in-basket-math.md
  - 03-candidate-capture-and-management-ux.md
---

# Design the two-pane Restock decision UI

## Question

How should the plan-item **candidate list** and **retailer basket** panel present selection (one candidate per item), cycle-scoped prices, shipping cost, all-in totals, and soft nudges so the user can decide where to buy — replacing today's offer grid?

## Resolution

**Answer:** **Variant A — Items + sidebar baskets** on the existing Restock grid (2/3 plan items, 1/3 sticky retailer baskets). Reuses ticket 03's **selected row + retailer chips + Manage options** on each item card; replaces the offer table entirely.

### Left pane — plan items
| Element | Behavior |
|---------|----------|
| **Item header** | Subject name, group badge, on-hand / run-out, editable qty (suggested qty hint) |
| **Selected row** | Highlighted strip: label, retailer, Check Site ↗, cycle price input, computed $/pill (sticker-only, entered price ÷ candidate count) |
| **Retailer chips** | One tap selects/deselects candidate; show $/pill when that candidate has a cycle price; ★ when lowest among ≥2 priced options with count |
| **Manage options** | Opens shared candidate drawer (ticket 03) — not inline matrix |

### Right pane — retailer baskets (sticky)
| Element | Behavior |
|---------|----------|
| **One card per retailer** with ≥1 selected line |
| **Line list** | Subject name, candidate label snippet, qty, line total or "no price" |
| **Totals block** | Subtotal → shipping row (Free / $X / omitted when threshold met) → **all-in** bold; "Incomplete" / "Shipping cost unknown" when applicable |
| **Shipping nudge** | Gap bar + copy on subtotal only; "threshold not set" link; "free shipping met" ✓ |
| **Cheapest all-in** | Badge on tied winner(s) among complete, shipping-known baskets only |
| **Retailer color accent** | Stable hue per retailer (household-wide): left border on basket card; same hue on selected chip and selected row so items visually tie to their basket |
| **Mark as Purchased** | Per basket (ticket 05 scope) |

### Global nudges
- **Cheapest-all-in callout** (optional banner above grid, stolen from Variant C): when ≥2 eligible baskets, one line naming tied retailer(s) — informational only.
- Unassigned count footnote when items lack a selected candidate.

### Variants rejected
- **B (Retailer tabs):** good for checkout focus but hides cross-retailer item comparison while assigning prices.
- **C (Linked panes):** cross-highlight is nice polish; defer unless user testing asks for it — A already keeps both panes visible.

**Asset:** Prototype route `/prototype/two-pane-restock?variant=A|B|C` (A recommended)
