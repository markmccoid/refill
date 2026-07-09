# Slice 02 — Insights overview shell

## Contract unlocked

Change `/insights` from a nutrient report page into a neutral overview: KPI cards at the top, report cards below, and no report selected by default.

## UI contract

Top KPI cards:

- Household monthly cost — current-rate estimate.
- Monthly cost by active person — either a compact comparison or a total with person labels.
- Planned pills/day — current active regimen.
- Items running out within the configured forecast window.
- Next projected run-out.

Report cards:

- Per-person cost breakdown
- Planned intake over time
- Current regimen by person
- Inventory and run-out outlook
- Nutrient coverage

Each card must have a title, purpose, basis, and clear open action. Do not auto-open the first card, preserve a URL/query state only if it does not make the initial view select a report.

## Likely files

- `app/(app)/insights/page.tsx`
- `components/insights/*`
- new shared `InsightKpiCard`, `InsightReportCard`, and empty/loading state components if reuse is real
- `convex/insights.ts` or the projection module from Slice 01

## States

- Loading: preserve the existing lightweight loading treatment.
- No people: explain that people and dosages are needed for planning KPIs.
- No supplements: show overview structure with empty KPI values and report cards.
- No dosages: distinguish “nothing scheduled” from “data unavailable.”
- Narrow viewport: cards stack; no horizontal overflow.

## Verification

- Render `/insights` with no report selected on first load.
- Keyboard tab order reaches each KPI/card action.
- Test one person, multiple people, paused person, grouped supplement, and no-data fixtures.
- Run `npm test` and `npm run build`.
- Capture a screenshot of the overview and run an unbiased visual critique before accepting the slice. Review only hierarchy, density, card affordances, and the absence of a default report; report-detail styling is out of scope.

## Done when

The first screen communicates planning/budgeting value within seconds and every report is discoverable without burying the existing nutrient report.

