# Slice 03 — Per-person cost breakdown

## Contract unlocked

Provide the requested detailed cost report, opened from the overview card. It must distinguish current habit cost from lifetime cash paid.

## Report layout

- Header: “Per-person cost breakdown”.
- Basis line: “Current-rate estimate using active dosages and the open bottle’s cost per pill.”
- Person summary rows: day, week, month.
- Detail table:
  - person;
  - supplement/group;
  - pills/week and pills/day;
  - cost/day and cost/month;
  - open cost per pill;
  - status for paused/not scheduled.
- Household total and subject totals.
- Optional lifetime purchase column only if clearly labeled “lifetime bottle spend” and not assigned to people.

## Rules

- Shared subjects allocate by effective dosage rate.
- Grouped brands appear as one group subject in the main table.
- Current paused/disabled people follow existing cost semantics.
- Zero-rate rows are retained only when they explain a person’s regimen; otherwise avoid misleading empty cost rows.
- Do not imply that current-rate spend equals historical bills.

## Likely files

- `convex/costs.ts` or report projection module
- `app/(app)/insights/page.tsx`
- `components/insights/CostByPersonReport.tsx`
- tests next to existing test style

## Verification

- Assert allocation totals equal each subject's current cost within a small floating-point tolerance.
- Assert group subjects are not double-counted.
- Assert paused/disabled rates are excluded.
- Browser-check sorting, long names, zero-rate states, and empty household.
- Run `npm test` and `npm run build`.
- Screenshot-critique the detail report for table scanability, hierarchy, and cost-basis clarity.

## Done when

A household can answer “what does each person’s current regimen cost, and which supplements drive it?” without navigating to the separate Costs page.

