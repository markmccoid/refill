# Slice 06 — markPurchased match-or-add backend

## Contract unlocked

**Mark as Purchased** accepts explicit supplement destinations, creates supplements/groups as needed, logs bottles with candidate URL, leaves candidates durable.

## API seam

**Mutation:** `restock.markPurchased` — new args shape:

```ts
lines: Array<{
  itemId: Id<"restockItems">;
  qty: number;
  pricePerBottle: number;
  countPerBottle: number;
  destination:
    | { kind: "existing"; supplementId: Id<"supplements"> }
    | {
        kind: "new";
        name: string;
        formGroupWithSubjectId?: Id<"supplements">; // solo opt-in checkbox
        joinGroupId?: Id<"groups">;                 // group add-new auto-join
      };
}>;
```

**Per line:**

1. Resolve destination supplement (create if new; auto-join group or form group per ADR)
2. Re-anchor + insert `qty` bottles with `purchaseUrl` = candidate URL, `retailerId`
3. Write through saved purchase link (existing retailer helper)
4. Mark restock item purchased

**Validation:** reject if item's selected candidate retailer ≠ basket retailer; reject auto-guess (destination required).

## Human can run

Convex test or integration script calling mutation with fixture ids.

## Verification

- [x] Existing supplement path logs bottles on chosen brand
- [x] New supplement on solo subject; optional group formation creates group with 2 members
- [x] New supplement on group subject joins group
- [x] Candidate row unchanged after purchase
- [x] Unchecked lines (not in `lines` array) stay active on plan
- [x] Unit/integration tests for destination resolution

## Depends on

Slice 05.

## Done when

Backend supports full match-or-add contract; UI dialog can be wired in slice 09.
