# Bottles are priced FIFO records; spend is derived cost-of-consumption

To track spend, a supplement's inventory changes from a single blended pill count to an **ordered list of bottle records**, each carrying its own `count` and `price` (and purchase date). On-hand becomes the sum across bottles; the **open bottle** is the oldest not-yet-emptied bottle and **sealed spares** are the newer full ones — derived by walking the list oldest-first (FIFO) instead of dividing a blended total by jar size.

Spend is modeled as **cost-of-consumption, not cash-out**: a person's spend rate = their consumption rate × the **open bottle's cost per pill** (`price ÷ count`), shown per person and per household across day/week/month windows. Cost per pill steps up as each bottle empties (FIFO). **Lifetime spent** (sum of all bottle prices, including emptied bottles) is tracked at the supplement and household level only, not per person.

This **refines ADR-0001, it does not replace it.** The core mechanic survives unchanged: no cron, on-hand computed at read time, and the re-anchor invariant. Re-anchoring now snapshots *each bottle's* current remaining (anchor distributed oldest-first) with anchored-at = now, on every real-world change — including adding a bottle.

## Considered Options

- **Keep the blended anchor; add one `price` you overwrite on restock (latest-price cost)** — rejected: cannot express accurate spend as prices change over time, and gives no honest lifetime total.
- **Blended anchor for count + a separate purchase log for cost** — rejected: count and cost drift out of sync because the anchor can't say which priced bottles are still on hand.
- **Priced bottle ledger with FIFO depletion** — chosen: cost is exact and matches physical reality (finish the open bottle before opening a spare), supports mixed bottle sizes, and makes "edit the supplement, add a bottle" the whole restock UX.
- **Average-on-hand or all-time-average cost** — rejected: average-on-hand needs the same bottle records as FIFO but is less physically true; all-time-average is dragged forever by long-gone cheap bottles.

## Consequences

- `jarSize` demotes to a per-supplement **default** that pre-fills the add-bottle form; it is no longer authoritative for any real bottle.
- The open/sealed derivation (`getBottleBreakdown`) is replaced by a FIFO walk over bottle rows that tolerates mixed counts. Consumption already yields a "total consumed" figure, which is distributed oldest-first.
- Emptied bottles are **never deleted on emptying** — they stay as history to feed lifetime totals. "Empty" is derived, not a stored state.
- First entry uses the same add-bottle flow as restocking (a shared `BottleFields` component): you add full bottles individually with their own count/price/link/date. A partially-used first bottle is corrected afterward with `bottles.recount`. Only the one-time backfill of pre-ledger data still splits current stock into one partial open + N full spares.
- A truthful **historical** spend chart is deliberately out of scope: it would require an event log of rate/price/taker changes over time. The bottle records do not block adding that log later.
