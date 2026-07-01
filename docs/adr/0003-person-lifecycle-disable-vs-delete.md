# People have a disable (paused) state distinct from permanent delete

A person can be **disabled** (soft, reversible) or **deleted** (permanent). `people.status` (`"active" | "disabled"`, missing ⇒ active) is the **single source of truth** for who currently consumes supplements. Disabling is the safe default surfaced everywhere; permanent delete is fronted by a blast-radius confirmation.

A disabled person is treated as no longer taking anything: their `dosages` rows are **kept** but excluded from every consumption-rate computation, so run-out forecasts extend and costs drop. Nothing is denormalized onto the dosage — readers exclude by joining `person.status`.

## Considered Options

- **Delete only (cascade dosages)** — rejected: no recovery path; an accidental delete permanently loses per-supplement dosing.
- **Denormalize `active` onto each dosage** — rejected: two sources of truth; a missed patch on disable/enable/delete silently mis-forecasts, and reads still work so the bug is invisible.
- **Disable + delete, exclude at query time (chosen)** — `person.status` is authoritative; `getActiveDosages` (server) and the `personActive` flag on `dosages.listBySupplementId` (client) drop disabled people's dosages from the rate while still letting the UI show them as *paused*. One source of truth, no drift.

## Consequences

- Disable and enable **must re-anchor every supplement the person doses before flipping status** (ADR-0001): disable freezes on-hand at the still-including rate; enable freezes at the now-excluding rate. Order is invariant-critical.
- Supplements are **household-owned, never person-owned** — losing the last taker just drops a supplement to rate 0 (never runs out); it is never deleted as a side effect.
- Delete re-anchors, removes the person's dosages, then the person; it is irreversible. The confirm dialog lists affected supplements and offers Disable instead.
- Every place that derives a consumption rate must exclude disabled dosages: `supplements.list`, `costs.summary`, `reanchorSupplement`, and the client detail/list views. Miss one and that surface over-consumes. `getActiveDosages` and `personActive` are the two chokepoints to route through.
- Disabled people are hidden from assignment pickers and the costs breakdown, shown greyed under a "Disabled" section on the People page and as paused rows on the supplement detail page.
