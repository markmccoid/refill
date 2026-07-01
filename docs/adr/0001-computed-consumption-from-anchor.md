# Pill counts are computed from an anchor, not stored or decremented by a job

> Refined by [ADR-0002](0002-priced-bottle-ledger-and-fifo-cost.md): the anchor now distributes across an ordered list of priced bottle records (FIFO). The compute-on-read, no-cron, and re-anchor invariants below still hold.

We track supplement depletion by storing a **quantity anchor** (total pills on hand) plus an **anchored-at** timestamp, and computing the current on-hand count at read time as `anchor − consumptionRate × daysElapsed` (floored at zero). There is deliberately **no cron / scheduled mutation** decrementing counts, and we never write the decremented value back — the anchor is the single source of truth. The open/sealed bottle breakdown is likewise derived from the on-hand total and jar size, so "opening the next bottle" needs no trigger.

## Considered Options

- **Scheduled job that decrements `remaining` daily** — rejected: needs cron infrastructure, runs even when nobody's looking, and the stored number drifts from truth between runs.
- **Write the consumed-down value back on app load** — rejected: a mutation on every page load, race conditions, and "when you last opened the app" becomes load-bearing.
- **Anchor + derive on read** — chosen: no infrastructure, always exact for the current instant, trivially correct after the app is idle for weeks.

## Consequences

- Any change to the count, a dosage, the set of takers, jar size, or stock **must re-anchor** (snapshot current on-hand → anchor, anchored-at → now). Otherwise a rate change retroactively re-rates elapsed time. This is invariant-critical, not optional.
- Consumption is a **smooth daily average** (`Σ pillsPerWeek ÷ 7`); we do not model specific weekdays, so short-term counts can differ from a strict Mon/Wed/Fri reality.
- On-hand can be fractional internally; it is rounded only for display.
