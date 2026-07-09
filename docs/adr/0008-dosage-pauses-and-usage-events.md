# Dosage pauses live on dosages; usage history lives in events

People can temporarily stop taking one supplement, or all supplements in their
regimen, without removing the dosage. This supports cases like pausing several
supplements before a blood draw while keeping inventory, forecasts, costs, and
future usage reports honest.

## Decision

- The live pause state is stored on each `dosages` row:
  - `pausedAt`
  - optional `pauseUntil`
- A dosage is actively paused when `pausedAt` exists and `pauseUntil` is missing
  or in the future.
- A dated pause auto-resumes by timestamp. There is no scheduled resume job.
- Inventory math treats actively paused dosages as `0/wk`.
- Bottle ledgers use pause-aware elapsed consumption so an expired pause does
  not retroactively draw down inventory during the paused interval.
- The People screen is the primary pause UI:
  - row-level pause/resume/edit pause
  - a separate `Paused` section under each person
  - `Pause all` writes pause state onto every currently active dosage for that
    person
- Reporting history is stored separately in append-only `dosageEvents`.

## Reporting Model

Future usage reports should be based on planned consumption, not daily
confirmation. For example, if Mark has Fish Oil at `7/wk` and it was active for
100 days in the requested range, the report can estimate 100 pills taken.

`dosageEvents` records context for future reporting and audit:

- `baseline` for existing dosages known when the feature ships
- `created`
- `changed`
- `paused`
- `resumed`
- `removed`

Change events store both previous and next weekly rates. Pause events store the
pause start and optional planned end. Existing dosages get a simple baseline
event that means "known as of migration time," not "started on this date."

## Consequences

- Re-anchor before every pause, resume, dosage edit, add, or removal so elapsed
  time is accounted for at the old effective rate.
- Manual resume clears the pause fields after re-anchoring. The event log keeps
  the pause context for future reports.
- `Pause all` is a bulk write to dosage rows, not a separate person-level
  override. This keeps per-supplement visual indicators truthful and lets one
  supplement resume early.
- A newly added dosage while other dosages are paused is active unless it is
  paused explicitly later.
