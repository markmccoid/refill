---
label: wayfinder:grilling
status: closed
assignee: cursor
parent: ../MAP.md
blocked_by:
  - 01-formalize-candidate-product-domain.md
---

# Design Mark as Purchased match-or-add flow

## Question

At **Mark as Purchased** for a retailer basket, how does the user **match** each selected candidate to an existing **Supplement** or **add a new** one (including Group membership when the subject is a Group), confirm qty/price/count, and keep the candidate link for future use — without the system guessing the match?

## Resolution

**Answer:** Evolve today's per-retailer **PurchaseDialog** into a **match-or-add confirmation** — one modal per retailer basket, one block per plan line. Keeps include checkbox + purchased date + editable actuals; adds required **Land as** radio per included line.

### Dialog shell (unchanged spirit)
- Trigger: **Mark as Purchased** on a retailer basket card (ticket 04)
- Header: retailer name + short copy ("Adjust anything that differed at checkout…")
- Footer: purchase date, line total, Cancel / **Confirm purchase**
- **Confirm disabled** until every *included* line has a valid destination + actuals

### Per-line block (included lines)
| Section | Behavior |
|---------|----------|
| **Include checkbox** | Checked by default; unchecked → line not logged, **stays on plan** |
| **Header** | Restock subject name + candidate label (read-only context) |
| **Land as** (radios, **none pre-selected**) | **Solo subject:** that Supplement · **Add new supplement**. **Group subject:** each group member · **Add new supplement** (auto-joins group — show *"Will add to [Group name]"* on the Add-new row) |
| **Add-new fields** (when Add new selected) | Editable **name** pre-filled from candidate label (required non-empty). **Solo only:** unchecked checkbox *"Form a group with [subject name]"* |
| **Actuals** (editable grid) | **Bottles** ← planned qty · **Price/bottle** ← cycle entered price · **Pills/bottle** ← candidate count (blank when plan lacked value) |
| **URL** | Not shown — candidate URL applied to each logged bottle and saved purchase link (Supplement + Retailer) automatically |

### Confirm effects (per included line)
1. Resolve destination Supplement (existing pick, or create new + optional group form / auto-join)
2. Log `qty` individual bottle rows via existing re-anchor path
3. Set bottle purchase URL from **candidate URL**; refresh saved purchase link
4. Mark restock item **purchased** (removed from active plan)
5. **Candidate Product** on subject unchanged — durable for next cycle

### Validation rules
- Included line without a **Land as** selection → Confirm off
- Add new with empty name → Confirm off
- Any included line with invalid qty / price / count → Confirm off
- No auto-match, no pre-selected radio, no household-wide supplement search

**Asset:** Current reference implementation to supersede: `components/restock/PurchaseDialog.tsx`
