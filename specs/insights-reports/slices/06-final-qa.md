# Slice 06 — Final QA and documentation

## Contract unlocked

Close the feature with a focused regression pass and durable documentation of metric semantics.

## Required checks

- `npm test`
- `npm run build`
- `npm run lint` or document the existing lint-script failure if the repository’s Next version no longer supports it
- manual browser pass at `/insights` for empty, single-person, multi-person, grouped, paused, disabled, missing-facts, and run-out states
- verify no report is selected on initial navigation or refresh
- verify all report labels distinguish current snapshots, lifetime purchases, and estimated planned intake
- inspect Convex query payloads for unnecessary duplication before accepting the final implementation

## Documentation changes

Update the project’s durable documentation, likely `CONTEXT.md` or a new ADR, with:

- definitions for current-rate cost, lifetime bottle spend, and estimated planned intake;
- the baseline-event limitation;
- group reporting semantics;
- the rule that Insights opens as an overview, not a default report.

Do not copy implementation file lists or stale route descriptions into `DOCS.md`; use the project’s documentation conventions.

## Done when

The implementation, tests, UI copy, and domain documentation all use the same metric names and caveats, and the spec README is updated with shipped status and evidence.

