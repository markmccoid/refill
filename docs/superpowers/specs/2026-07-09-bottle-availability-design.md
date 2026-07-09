# Bottle Availability Design

## Goal

Let users log bottles before they are usable without those bottles being counted as on-hand or depleted early.

## Vocabulary

- **Available date**: The bottle date users enter. This is the day the bottle can start being consumed.
- **Available stock**: Pills in bottles whose available date is today or in the past.
- **Incoming stock**: Pills in bottles whose available date is in the future.
- **Current stock status**: Run-out, on-hand, open bottle, and current spend information based only on available stock.

The first implementation may keep the existing internal field name `purchasedAt`, but all primary UI labels should say "Available date."

## Consumption Rules

1. Bottles with a future available date do not participate in depletion.
2. Consumption drains available bottles only, ordered by available date. Bottles with the same available date drain in database/insertion order.
3. If no available pills exist, consumption pauses. The app does not create pill debt.
4. When a future bottle becomes available, it starts full with its current `remainingAtAnchor` and depletes only from that date forward.
5. Editing a bottle's available date re-anchors first and preserves its current remaining pill count. Moving a partially used bottle into the future hides the remaining pills from available stock until that date, but does not refill it.
6. Groups follow the same rule across the pooled bottle queue: only available bottles across member brands can be open or depleted.

## Forecasting And Cost

- Days-left, run-out status, open bottle, and current spend rate use available stock only.
- If a dosage exists but no stock is available, the supplement is out. Current spend is `$0/day`.
- Lifetime spend includes every logged bottle immediately, including incoming bottles.
- Restock recommendations may count incoming stock to avoid duplicate purchases, but the UI must make the split visible.

## Dashboard

- Dashboard cards and status counts use available stock only.
- The run-out timeline shows incoming stock separately in a different color and labels it "Incoming."
- Incoming stock does not make an out-of-stock supplement appear safe today.

## Restock Planner

- Picker and plan rows should show available and incoming stock separately.
- Recommended quantity should use available plus incoming stock so already-logged future bottles reduce duplicate buy suggestions.
- Urgency can still be based on available days-left, so an item can be urgent/out while also showing incoming stock.

## UI Copy

- Bottle form label: "Available date."
- Helper text: "Future dates are treated as incoming and won't be used until then."
- Existing purchase link copy can remain purchase-oriented because it describes where the bottle was bought, not when it is consumed.

## Non-Goals

- No separate purchase date in this pass.
- No manual "arrived" status.
- No package tracking.
- No negative inventory or catch-up depletion.
