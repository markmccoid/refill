# Slice 03 — Retailer standard shipping cost

## Contract unlocked

**Retailer** entity carries optional **standard shipping cost**; editable in Retailer dialog; consumed by slice 01 basket math.

## API seam

**Schema:** add `standardShippingCost: v.optional(v.number())` to `retailers` table.

**Convex:** extend `convex/retailers.ts` create/update validators.

**UI:** `components/restock/RetailerDialog.tsx` — optional field with same unset≠zero semantics as threshold (helper copy: "leave blank if unknown").

**Types:** ensure `api.restock.plan` retailer shape includes `standardShippingCost` once slice 05 updates plan query.

## Human can run

`npm run dev` → Restock → edit retailer → set threshold + shipping cost → field persists on reload.

## Verification

- [x] Dialog saves and loads standard shipping cost
- [x] Slice 01 math tests still pass with new field passed through `RetailerShippingConfig`
- [x] `npx tsc --noEmit` green

## Depends on

Slice 01.

## Done when

Households can store flat shipping fee per retailer for all-in basket display.
