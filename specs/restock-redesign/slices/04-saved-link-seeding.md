# Slice 04 — Saved-link seeding

## Contract unlocked

Hybrid seeding per ticket 06 / ADR-0009: silent one-time migration, ongoing auto-add, manual import with preview.

## API seam

**Module:** `convex/candidateSeeding.ts`

| Function | Behavior |
|----------|----------|
| `previewImport` | Returns count of new candidates for a subject (saved links + bottle URL fallback, dedupe by URL) |
| `importForSubject` | Creates candidates; label = source supplement name; count = recent bottle or jar size |
| `seedHousehold` | Internal migration: all subjects in household, silent |
| `maybeSeedFromSavedLink` | Called from savedLinks upsert / bottle write-through — auto-add if URL novel on subject |
| `maybeSeedFromUrlChange` | Old URL candidate kept; new URL auto-added if missing |

**Solo subject:** that supplement's links + bottle fallback (most recent per supplement×retailer).

**Group subject:** aggregate all member supplements.

**Explicitly not:** sync label/count on link edit; delete candidate when link removed; household-wide one-click import.

## Migration

- Register one-time migration (Convex internal mutation or deploy hook) calling `seedHousehold` per household — **no UI banner**.

## Human can run

After migration on dev household: open subject with saved links → candidates exist. Drawer import (slice 07) can call `previewImport` early via dashboard.

## Verification

- [x] Fixture household: saved links → candidates with expected label/count
- [x] Duplicate URL skipped
- [x] Group aggregates members
- [x] New saved link creates candidate when URL novel
- [x] URL update on saved link adds new candidate, leaves old
- [x] `npm test` for pure dedupe/source-list helpers if extracted

## Depends on

Slice 02, 03.

## Done when

Existing households are not starting from blank candidates; ongoing logging keeps candidates in sync for new URLs only.
