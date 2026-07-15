# Slice 07 — Candidate drawer and subject summary

## Contract unlocked

Shared **Manage options** drawer (ticket 03) wired to Convex; subject page summary card.

## API seam

**Components:**

- `components/restock/CandidateDrawer.tsx` — port Variant C from `components/prototype/candidate-capture/VariantC.tsx`
- `components/restock/CandidateSummaryCard.tsx` — count + 2–3 label preview + Manage button

**Props:** `subjectKind`, `subjectId`, `householdId`, optional `restockItemId` for context banner.

**Drawer behaviors:**

- List, inline add, inline edit, delete (confirm if selected on active plan item)
- Duplicate URL → block + scroll to existing row
- **Import from saved links** → `previewImport` then `importForSubject`
- Retailer dropdown + Add retailer dialog

**Surfaces:**

- `app/(app)/supplements/[id]/page.tsx` — summary card for solo subject
- Group subject surface (group detail page or equivalent — resolve known unknown from README)

## Human can run

`npm run dev` → subject page → Manage → CRUD candidates → Import preview.

## Verification

- [x] Drawer opens from subject page; context banner shows source
- [x] Create/edit/delete round-trip via Convex
- [x] Duplicate URL blocked
- [x] Import shows preview count and adds only new URLs
- [x] **Visual gate:** capture drawer + summary card; run **screenshot-critique** before accepting
- [x] **Compare gate:** use **compare-screenshots** against `/prototype/candidate-capture?variant=C` for layout hierarchy (list density, drawer width, add form placement). Crop: drawer panel only; motion and exact copy differences out of scope

## Depends on

Slices 02, 04.

## Done when

Durable candidate CRUD works outside Restock page; Restock slice 08 can call same drawer.

## Human review checkpoint (non-blocking)

Open captures with preview-shots; ~5 min for feedback. If silent, proceed and note rationale in README.

## Resolution notes (2026-07-14)

- **Group surface:** no dedicated group detail route — `CandidateSummaryCard` lives on expanded `GroupListItem` (`/supplements`). Solo card on supplement detail only when ungrouped (candidates attach to group subject when grouped).
- **Backend:** `listBySubject` returns `selectedOnActivePlan`; `remove` clears active plan selections.
- **Visual:** captures under `assets/slice-07/`. Compare vs Variant C: same hierarchy (context banner → title → list → quick add → Done). Intentional deltas: retailer dropdown + Add retailer dialog, Import block (ADR). Critique noted sparse lower drawer / muted import link — accepted as Variant C parity + disabled empty import state; not blocking.
- Smoke: create candidate, duplicate URL blocked + expands existing, summary count updates.
