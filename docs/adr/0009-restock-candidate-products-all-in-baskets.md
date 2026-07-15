# Restock decision support: candidate products, all-in baskets, match-or-add purchase

ADR-0006 shipped the Restock Planner with a **brand×retailer Offer matrix** per plan item: every grouped brand crossed with every household retailer, average past prices as $/pill fallback, and purchase assumed to land on the pre-selected brand. That matrix grew quickly, locked comparison options to brands already in inventory, and hid **all-in** cost once households wanted to compare retailers honestly below free-shipping thresholds.

This ADR records the redesign that **supersedes ADR-0006** wherever the two conflict. It keeps ADR-0006's foundations — manual entered prices, user-curated plan membership, first-class Retailer entity, derived retailer orders, session-scoped prices, forecast window + coverage target knobs, no scraping — and replaces the Offer model with **Candidate Products**, **all-in basket totals**, and **match-or-add** purchase completion. Domain terms live in `CONTEXT.md`; this ADR is the implementation-facing contract.

Design source: `.scratch/restock-redesign/` wayfinder map (issues 01–06). The closed implementation record and retained visual provenance live in `specs/done/restock-redesign/`.

## Considered Options

- **Candidate Product library on the restock subject (chosen) vs brand×retailer Offer matrix.** The matrix conflated "which product page" with "which inventory brand" and regenerated rows as retailers were added. Candidates attach to the restock **subject** (solo Supplement or Group), carry Retailer + URL + label + count, allow substitutes not yet stocked, and persist across cycles. One candidate per URL per subject; selection and entered price stay cycle-scoped on the Restock item. **Offer** is retired.
- **All-in retailer basket totals (chosen) vs threshold-gap only (ADR-0006).** Gap-to-free-shipping alone cannot compare baskets when standard shipping applies below threshold. Retailer gains optional **standard shipping cost** (durable, edited in Retailer dialog). **All-in** = subtotal + applied shipping; incomplete or shipping-unknown baskets are excluded from cheapest-basket nudges. **$/pill** stays sticker-only (entered price ÷ candidate count); shipping is never allocated to pills.
- **Match-or-add purchase (chosen) vs implicit brand from selection.** Candidates are not bound to a Supplement until purchase. **Mark as Purchased** requires an explicit **Land as** choice per line — subject-scoped existing Supplement or Add new — with no default and no auto-guess. Candidate URL flows to logged bottles and saved purchase links; the candidate itself remains on the subject.
- **Hybrid saved-link seeding (chosen) vs blank start vs full sync.** One-time silent migration plus ongoing auto-add when new URLs appear; manual **Import from saved links** in the candidate drawer. Saved links and candidates stay separate — no bidirectional sync, no auto-delete.

## Decision

### Candidate Products

- Stored on the restock **subject** (solo Supplement or Group), not on the plan item or a grouped brand.
- Fields: **Retailer**, **URL**, **label** (required), **count** (optional for save/select; required for $/pill nudges).
- Many per subject; substitutes and never-yet-stocked brands allowed.
- One candidate per literal URL per subject; edit in place to update.
- Lifecycle: deleted with subject; survive Restock item removal; migrate into a Group when subjects form/join it; migrate to the survivor on Group auto-dissolve; URL-dedupe on either migration; deleted on full Group teardown.
- **Saved purchase link** remains a distinct per-(Supplement, Retailer) entity and may seed candidates (see Seeding).

### Restock Plan item

- Subject is solo Supplement or whole Group — never an individual grouped brand.
- Exactly **one selected candidate** per item per cycle; **entered prices are keyed by candidate** and **planned qty** stays on the Restock item. Changing selection never transfers price.
- Recommended qty uses selected candidate's count and coverage target (unchanged formula spirit from ADR-0006).

### Candidate capture UX

- One **shared drawer** for CRUD from the subject page and Restock item (**Manage options**).
- Subject page: summary card (count + preview). Restock item: **selected row + retailer chips** + cycle price when drawer is closed.
- Drawer: inline add/edit, duplicate URL blocked (offer edit existing), confirm delete if selected on active plan item.
- **Import from saved links** always available with preview count before add.

### Restock page layout (two-pane)

- **Left (2/3):** plan item cards per above — replaces Offer table.
- **Right (1/3, sticky):** one **retailer basket** card per retailer with selected lines.
- **Per-retailer color accent** (stable household-wide): basket left border, selected chip, and selected row share the same hue.
- Basket card: line list, subtotal, shipping row, **all-in**, gap / free-shipping met, cheapest-all-in badge (complete + shipping-known only), **Mark as Purchased**.
- Soft nudges only: cheapest all-in basket and gap/met per retailer. Optional cheapest-all-in banner above grid when ≥2 eligible baskets.
- Plan membership picker, forecast window, and coverage target knobs unchanged from ADR-0006.

### All-in basket math

| Concept | Rule |
|--------|------|
| Line total | `qty × entered price` (unpriced → "no price") |
| $/pill | `entered price ÷ candidate count` (informational) |
| Subtotal | Sum of priced lines only |
| Complete basket | Every line has entered price |
| Applied shipping | Retailer's standard cost when threshold unset or subtotal below threshold; $0 when met |
| All-in | Subtotal + applied shipping |
| Shipping unknown | Below threshold but no standard cost on Retailer |
| Gap to free shipping | `threshold − subtotal` (shipping excluded) |

Retailer entity adds optional **standard shipping cost** (unset = unknown). No per-cycle shipping override in v1.

### Mark as Purchased (match-or-add)

- One modal per retailer basket; one block per plan line.
- **Include** checkbox (default on); unchecked lines stay on the plan.
- **Land as** radio group per included line — **none pre-selected**:
  - Solo subject: that Supplement · Add new supplement.
  - Group subject: each group member · Add new (auto-joins group; show copy).
- Add new: editable name pre-filled from candidate label; solo gets optional unchecked **Form a group with [subject]**.
- Actuals pre-filled from plan (qty, price, count), all editable. Confirm disabled until destination + valid actuals.
- On confirm: create/match Supplement, log bottles via existing re-anchor path, write candidate URL to bottles + saved link, mark item purchased. Candidate unchanged on subject.

### Saved-link seeding

- **One-time migration (ship):** silent; solo from that supplement's links + bottle URL fallback; group from all members; dedupe by URL; label = source supplement name; count from bottle history or jar size.
- **Ongoing:** auto-add candidate on new saved link or URL change (keep old-URL candidates); bottle URL fallback when no saved link; no label/count sync; no delete on saved-link removal.
- **Manual:** drawer import with preview count; same rules; per-subject only.

## Consequences

- **Schema:** new candidate storage on subject; Restock items reference selected candidate (not supplement+retailer offer pair); Retailer gains standard shipping cost; Offer-related fields removed from restock items.
- **Migration:** completed in production on 2026-07-15. Backfill scanned 3, backfilled 1, and skipped 2 with no selection issues; clear scanned 3, cleared 1, found 2 already clear, and reported `skippedNotBackfilled: 0`. The legacy scalar and temporary migration functions are now removed.
- **ADR-0006 kept:** manual prices, no scraping, curated plan, Retailer entity, derived orders, session-scoped entered prices, two household knobs, per-bottle purchase logging, retailers not deletable in v1.
- **ADR-0006 replaced:** Offer matrix, average price as $/pill fallback, implicit brand at purchase, threshold-gap-only totals (shipping fee now in all-in when configured).
- **Out of scope (unchanged):** price scraping, retailer optimizer, tax modeling, subscribe-and-save modeling, rebuilding plan membership/urgency/coverage UX.
- **Deferred polish (not blocking build):** historical average price surfacing on candidates, optional candidate notes, motion/animation, Check Site multi-tab workflow details.

## Supersedes

- **ADR-0006** — Offer model, average-based $/pill, and gap-only shipping display where this ADR specifies candidates, sticker-only $/pill, all-in totals, and match-or-add purchase.
