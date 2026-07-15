---
label: wayfinder:grilling
status: closed
assignee: cursor
parent: ../MAP.md
blocked_by:
  - 01-formalize-candidate-product-domain.md
---

# Decide saved-link seeding rules

## Question

When and how do existing **saved purchase links** (and, if useful, bottle purchase URLs) become **candidate products** — one-time migration, ongoing sync, opt-in per subject, or not at all — so households aren't starting from a blank comparison list?

## Resolution

**Answer:** **Hybrid seeding** — saved links and candidates stay separate entities; seeding copies URL + retailer into new candidates without ongoing label/count sync.

### One-time migration (ship)
- Run **silently** for every household — no banner or per-subject notice
- **Solo subject:** seed from that Supplement's saved links + bottle purchase URLs where no saved link exists (most recent bottle wins per supplement×retailer)
- **Group subject:** aggregate from **all group members**; dedupe by literal URL on the group subject
- **Seeded fields:** Retailer + URL from source; **label** = source Supplement display name; **count** = most recent bottle count for that supplement×retailer, else default jar size, else blank
- Skip URLs that already have a candidate on the subject (literal URL match)

### Ongoing auto-add (post-ship)
- When a **new** saved link is created → auto-create candidate if no candidate with that URL on the subject
- When a saved link **URL is updated** → auto-add candidate for the new URL; **leave** any candidate with the old URL
- Same bottle-URL fallback as migration when logging a purchase creates a link without a pre-existing saved link
- **No sync** of label/count when saved links change later; **no delete** of candidates when saved links are removed

### Manual import (drawer)
- **Import from saved links** always available in Manage options (ticket 03 drawer)
- Same rules as migration; show preview count (*"3 new options"*) before adding; dedupe silently skips existing URLs

### Explicitly not
- Full bidirectional sync between saved links and candidates
- Household-wide search/import in one click (per-subject only)
- Auto-delete candidates when saved links go away

**Asset:** Seeding rules complement [CONTEXT.md](../../../CONTEXT.md) (Saved purchase link · Candidate Product)
