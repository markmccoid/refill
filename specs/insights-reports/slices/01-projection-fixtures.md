# Slice 01 — Report projection, fixtures, and tests

## Contract unlocked

Create the typed, server-owned data contracts that all Insights reports consume. This slice does not change the page layout. It makes cost allocation, effective dosage reconstruction, groups, pauses, disabled people, and date boundaries testable before UI work begins.

## Likely files

- `convex/insights.ts` or a new focused `convex/insightReports.ts`
- `lib/insight-utils.ts` for pure calculations only if that matches existing utility conventions
- `tests/insights.test.cjs` or the repository's established test shape
- generated Convex files only through `npm run convex:codegen`; never hand-edit generated output

## Required contracts

1. A stable subject identity: solo supplement or group, with display name and optional open-brand metadata.
2. Effective weekly dosage per person for a requested interval, respecting:
   - active/disabled people;
   - dosage pause/resume intervals;
   - created/changed/removed events;
   - baseline event start date;
   - grouped supplements as one consumed subject.
3. Current cost allocation:
   - current open-bottle cost per pill × current effective person consumption rate;
   - person share for a subject equals that person's effective rate divided by the subject's total effective rate;
   - lifetime bottle spend remains unattributed and labeled separately.
4. Report metadata containing basis/caveat text and data coverage start.

## Scenarios that must be deterministic

- One person, unchanged dosage for 90 days.
- Two people sharing one supplement at different rates; allocated costs sum to subject total.
- A paused dosage contributes zero during the pause and resumes at the saved rate afterward.
- A removed dosage contributes only before its removal event.
- A disabled person is excluded from current planning reports according to existing app rules.
- A group with two brands reports one subject and uses the pooled/open-brand cost basis.
- A baseline event limits historical coverage; no pre-baseline intake is fabricated.
- Empty household, no dosage, no bottles, and missing facts all return explicit empty/unsupported states.

## Verification

- Add unit tests for each scenario above.
- Run `npm test`; all existing and new tests pass.
- Run `npx tsc --noEmit` if available through the local toolchain; otherwise use `npm run build` as the type gate.
- Confirm no UI files are required to import internal Convex calculation helpers directly.

## Done when

The implementation has one documented owner for report math, typed projections can represent all empty/partial states, and the cost/intake calculations are covered without browser-dependent tests.

