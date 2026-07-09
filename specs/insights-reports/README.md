# Insights reports

## Next Agent Prompt

You are implementing the Insights reports feature in the Refill supplement-management app. Read this README and the slice files before changing code. The agreed product goal is planning and budgeting: Insights must open on a KPI/card overview, with no report selected by default. Implement slices in order, keep the existing nutrient report available as a card, and label historical intake as estimated planned intake. Do not claim historical consumption cost that the current data cannot reconstruct. After each slice, run its verification commands and update this section with status, evidence, and the next pickup point.

**Status:** In progress. Overview shell and per-person cost detail are implemented; planned-intake presentation exists but its historical data projection is not yet wired. 2026-07-09.

**Next pickup:** Complete the historical dosage-event projection, wire `PlannedIntakeReport`, then implement the regimen and inventory report cards.

**Sub-agent review:** The requested local lower-cost Codex review could not run because `codex --version` returned `Access is denied`. This plan was synthesized from direct repository inspection instead.

### Global checklist

- [ ] 01 — Report projection, shared types, fixtures, and tests
- [ ] 02 — Insights overview: KPI cards and report cards, no default report
- [ ] 03 — Per-person cost report
- [ ] 04 — Estimated planned intake over time
- [ ] 05 — Inventory/run-out and nutrient report integration
- [ ] 06 — Final browser/visual QA, copy audit, and performance review

### Evidence from current pass

- `app/(app)/insights/page.tsx` now opens on KPI cards and report cards; no report is selected initially.
- `convex/costs.ts` now returns `perPersonSupplement` detail rows for current-rate cost allocation.
- `components/insights/CostByPersonReport.tsx` renders person/supplement dosage and cost detail.
- `components/insights/PlannedIntakeReport.tsx` provides the typed presentation contract, filters, chart/table toggle, caveat, and empty/loading states, but is not yet connected to a dosage-event query.
- `npm test`, `npx tsc --noEmit --pretty false`, and `npx next build` pass.
- `npm run build` is blocked before Next build because `convex codegen` requires outbound access to the Convex service. `npm run lint` is already broken in this repository because `next lint` is interpreted as a directory argument by the installed Next version.

## Goal

Replace the current nutrient-first Insights page with a planning and budgeting hub. The landing view shows useful household KPIs and cards that open reports. Reports are independently reviewable and share consistent filters, empty states, terminology, and caveats.

## Decisions already made

- Primary audience: household planning and budgeting.
- Intake history: estimated planned intake reconstructed from dosage history; never presented as confirmed ingestion.
- Per-person costs: allocate a supplement/group's current cost by each person's dosage share.
- Date range: 90 days for historical intake; current snapshot for cost and inventory.
- No report is selected or expanded on initial Insights load.

## Existing evidence and constraints

- `app/(app)/insights/page.tsx` currently renders only nutrient Compare/Detail modes.
- `convex/insights.ts` aggregates current label facts and active dosages, but has no date range or report projection.
- `convex/costs.ts` already provides current per-person day/week/month cost and lifetime bottle spend, but not a supplement-by-person allocation matrix.
- `dosageEvents` records baseline, create, change, pause, resume, and remove events (`convex/schema.ts`, `convex/dosages.ts`).
- Bottles contain purchase date, price, count, retailer, and FIFO remaining state. This supports purchase-spend history, but not historical cost-of-consumption.
- Groups consume one brand at a time. Reports must display a group as one consumed subject unless explicitly showing brand/purchase detail.
- Active paused/disabled people must follow the existing effective-dosage rules.

## End-state architecture

One server-owned report projection layer should own report math and terminology. UI components should render typed projections rather than independently recomputing cost, dosage, group, or date-range rules. Prefer adding focused functions/queries under `convex/insights.ts` or a clearly named adjacent module over duplicating logic in pages.

Suggested report discriminators:

```ts
type InsightReportId =
  | "cost-by-person"
  | "planned-intake"
  | "regimen"
  | "inventory-outlook"
  | "nutrient-coverage";
```

Every report should define: title, one-sentence purpose, data freshness/basis, supported filters, empty state, and caveat text.

## Slice graph

```text
01 projection + fixtures
 └─> 02 overview shell
      ├─> 03 cost report
      ├─> 04 planned intake report
      └─> 05 inventory + nutrient cards
            └─> 06 final QA
```

## Scope firewall

In scope: Insights route, report queries/projections, report-specific components, deterministic unit tests, and documentation.

Out of scope: daily intake confirmation, medical advice or interpretation, changing dosage/inventory semantics, adding a consumption event log, changing the Costs route, retailer scraping, PDF export, mobile redesign beyond responsive report layout, and historical cost-of-consumption reconstruction.

## Verification baseline

- Unit tests: `npm test`
- Type/build check: `npm run build` (runs Convex codegen and Next build; may require the configured environment)
- Lint: `npm run lint` (note: the package script uses the repository's existing Next lint command)
- Any visual slice must be checked in a running browser at `/insights`, including empty, one-person, multi-person, paused, grouped, and missing-facts states.

## Review map

- Product review: overview hierarchy, KPI usefulness, report-card labels, and whether the first screen feels actionable.
- Data review: cost allocation, group handling, pause handling, baseline event caveats, and date-boundary behavior.
- Visual review: dense tables remain scannable; no report opens by default; cards have clear affordances and accessible keyboard focus.

## Known unknowns to resolve during Slice 01

- Whether baseline dosage events have a reliable migration timestamp for older households. If not, expose “history begins on [baseline date]” rather than inventing prior intake.
- Whether the product wants calendar-month purchase grouping or rolling 30-day grouping. Default to calendar month for purchase history if that report is later added; it is not required for the MVP slices.
- Whether a zero-rate supplement should appear in cost tables. Default: show it with $0 and a “not currently scheduled” state when it has active ownership but no effective intake.
