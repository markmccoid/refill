# Slice 04 — Estimated planned intake over time

## Contract unlocked

Add a 90-day historical report based on dosage events. It reconstructs planned intake, not confirmed ingestion.

## Report layout

- Header: “Estimated planned intake”.
- Prominent caveat: “Based on recorded dosage changes and pauses; this does not confirm what was actually taken.”
- Date range control with 30/90/180/365-day presets; default 90 days.
- Person filter and supplement/group filter.
- Chart/table toggle for accessibility and precise values.
- Stacked or grouped series by person, with optional subject drill-down.
- Summary totals: estimated pills, average pills/day, active days, paused days.
- Coverage note when the requested range begins before the baseline event.

## Data rules

- Integrate dosage event intervals, not the current dosage alone.
- A change event ends the prior rate at its timestamp.
- A pause interval contributes zero while preserving the saved dosage.
- Resume restarts the saved rate.
- Removed dosages stop contributing at removal.
- Use a clear day-boundary convention and test timestamps at midnight/local-day boundaries.
- Groups are one subject for aggregate intake; member brands may be shown only as an optional detail dimension.

## Likely files

- `convex/insights.ts` or `convex/insightReports.ts`
- `components/insights/PlannedIntakeReport.tsx`
- a small chart component using existing dependencies; do not add a chart library unless the existing stack cannot support the required interaction
- tests for interval reconstruction

## Verification

- Unit-test unchanged, changed, paused, resumed, removed, baseline-limited, and grouped intervals.
- Verify totals for 30, 90, and 365-day windows.
- Verify the chart has a table/accessibility alternative.
- Browser-check filter changes, no-data and pre-baseline states.
- Run `npm test` and `npm run build`.
- Screenshot-critique only the report’s readability, caveat visibility, and range/filter comprehension.

## Done when

The report gives a trustworthy answer to “what was this household scheduled to take over the last 90 days?” while making its estimate boundary impossible to miss.

