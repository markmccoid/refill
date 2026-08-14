# Groups may opt into manual-open concurrent drain

ADR-0004 remains the default: a Group is one pooled FIFO queue, one open bottle, sealed brands frozen, auto-roll when the open bottle empties. This ADR does **not** rewrite that. It adds an **opt-in overlay** for groups that keep several bottles on the counter at once.

A group with `drainMode: "manualOpen"` still has one group dosage and one shared anchor. Consumption splits **equally** across bottles the user has activated (`bottles.pinnedOpen`). Unpinned bottles freeze even if they are older. When an activated bottle is finished, the user recounts it to empty and activates the next — the walk does **not** FIFO-fill a replacement. If nothing is activated, consumption pauses (no pill debt).

Solo supplements are unchanged (single-bottle FIFO). Create-group stays FIFO. Missing `drainMode` means FIFO. Pins on bottles are ignored unless the owning group is `manualOpen`.

This **refines ADR-0004, it does not replace it.** Re-anchor stays all-or-nothing per group. The FIFO ledger walk (`getBottleLedger`) keeps its sequential public API; manual-open uses a separate equal-split walk.

## Considered Options

- **N-wide FIFO (oldest N bottles drain, auto-fill)** — rejected: the open set would always be the oldest bottles, which is not which tubs are actually on the counter.
- **Per-brand share / 6-6-1 weights** — rejected for v1: equal split of the group dosage is enough; a second "dosage" control would fight materialized group dosages.
- **Parameterize the FIFO walk in place** — rejected: FIFO groups must not drift. Sequential drain stays on `getBottleLedger`; manual-open is a separate walk dispatched from `getGroupState`.
- **Manual-open as the default** — rejected: existing groups and the Fish Oil one-at-a-time model stay sequential with no migration.

## Consequences

- Schema: optional `groups.drainMode` (`"fifo"` | `"manualOpen"`, missing = FIFO) and optional `bottles.pinnedOpen` (missing = false). No new tables, no dosage changes, no backfill.
- Switching FIFO → manual-open re-anchors, then pins the bottle that was FIFO-open so consumption does not silently pause. Switching back re-anchors, clears pins, and resumes oldest-first.
- Cost in manual-open is the unweighted average of activated bottles' cost-per-pill. FIFO cost stays the single open bottle.
- Insights skip a group when more than one brand is in the open set rather than blending labels.
- Forecast days-left is 0 while a manual-open group has stock but nothing activated — nothing is being consumed until the user starts a bottle.
