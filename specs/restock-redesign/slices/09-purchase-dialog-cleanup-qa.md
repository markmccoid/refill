# Slice 09 — Purchase dialog, legacy removal, final QA

## Contract unlocked

Ship complete feature: **match-or-add** dialog, delete Offer legacy, promote prototypes or remove throwaway routes.

## Purchase dialog

**Refactor** `components/restock/PurchaseDialog.tsx`:

- Per-line: include checkbox, subject + candidate label header, **Land as** radios (none pre-selected), add-new name field, solo group-formation checkbox, actuals grid pre-filled from plan
- Confirm disabled until valid
- Wire to slice 06 `markPurchased`
- No URL field — candidate URL used server-side

## Legacy removal

- Delete `selectOffer`, offer types, `enteredPrices` array handling
- Remove `/prototype/candidate-capture` and `/prototype/two-pane-restock` routes **or** gate behind dev-only if team wants keepers — default: **delete** after UI folded in
- Update `docs/adr/0006` header note pointing to ADR-0009 supersession (one line, no rewrite)
- Grep for `Offer`, `offerValidator`, `avgPrice` in restock path — zero hits

## Final QA scenarios (manual + automated)

| Scenario | Expected |
|----------|----------|
| Solo item, match existing | Bottles on subject supplement |
| Solo item, add new + form group | New supplement + group with 2 members |
| Group item, add new | New supplement joins group |
| Unchecked line | Stays on plan |
| Seeded candidate | Still on subject after purchase |
| Cheapest all-in with shipping | Badge on correct basket |

## Verification

- [ ] `npm test` green
- [ ] `npx tsc --noEmit` green
- [ ] `npm run build` if environment allows
- [ ] Manual smoke: full restock cycle add item → candidates → select → price → mark purchased
- [ ] **Visual gate:** screenshot-critique on purchase dialog (empty Land as vs filled)
- [ ] **Compare gate:** compare dialog structure to ticket 05 resolution table (no prototype — use spec crop: one line block with radios + actuals)

## Depends on

Slices 06, 08.

## Done when

ADR-0009 is fully implemented; spec README checklist complete; ready for [close-spec](../../.claude/skills/close-spec/SKILL.md) archive to `specs/done/`.

## Human review checkpoint (non-blocking)

Full flow demo via preview-shots; record any copy tweaks in README and proceed if silent.
