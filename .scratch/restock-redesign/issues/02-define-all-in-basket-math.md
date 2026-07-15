---
label: wayfinder:grilling
status: closed
assignee: cursor
parent: ../MAP.md
blocked_by: []
---

# Define all-in retailer basket math

## Question

Exactly how do item subtotals, optional **shipping cost**, free-shipping **threshold**, missing prices, **$/pill**, and soft nudges (cheapest signals, gap-to-threshold) combine into comparable **all-in** retailer totals for decision support — including what happens when the threshold is unset, unmet, or met?

## Resolution

**Answer:** All-in basket math uses **entered prices only** (no average fallback), **sticker-only $/pill**, and **stored standard shipping cost** on the Retailer entity.

### Per line (Restock item + selected candidate)
- Line total = `qty × entered price` (entered price required)
- $/pill = `entered price ÷ candidate count` (both required; informational, no shipping allocation)

### Per retailer basket
- **Subtotal** = sum of priced lines only; unpriced lines show "no price"
- **Complete** = every selected line has an entered price
- **Applied shipping** = Retailer's standard shipping cost when (threshold unset OR subtotal < threshold) AND cost is set; $0 when threshold met
- **All-in** = subtotal + applied shipping
- **Shipping unknown** = below threshold but no standard shipping cost on Retailer
- **Gap to free shipping** = `threshold − subtotal` (shipping does not affect gap)

### Nudges (informational only; ties show on all tied options)
| Nudge | Rule |
|---|---|
| Lowest $/pill (per item) | ≥2 candidates with entered price + count |
| Cheapest basket | ≥2 complete baskets that are not shipping-unknown; compare all-in |
| Gap / free-shipping met | Threshold set on Retailer |

### Retailer entity (durable)
- **Free-shipping threshold** (optional; unset = unknown)
- **Standard shipping cost** (optional; unset = unknown) — edited in Retailer dialog, not re-entered per cycle; no per-cycle override in v1

**Asset:** [CONTEXT.md](../../../CONTEXT.md) (Retailer, Retailer order)
