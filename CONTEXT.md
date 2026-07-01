# Refill

A household supplement-inventory tracker: what supplements people take, how much is on hand, when each will run out, and what it costs. Pill counts deplete over time automatically by computing consumption from an anchored snapshot — there is no scheduled job.

## Language

### Inventory

**Supplement**:
A distinct product a household stocks (e.g. "B-Right" by Jarrow). One entry, regardless of how many physical bottles are on hand.
_Avoid_: pill, vitamin (those are kinds of supplements, not the entry)

**Bottle**:
One physical container of a supplement, recorded as its own row with a **count** and a **bottle price**. A supplement owns an ordered list of bottles (oldest first). Adding a bottle = logging a purchase.
_Avoid_: jar, pill bottle, container

**Count**:
The label capacity of a specific bottle — a "100 capsule" bottle has count 100. Carried per bottle, so bottles of the same supplement may differ (a 120-count sale bottle next to a 100-count).
_Avoid_: jar size (that is now only the default), quantity

**Jar size**:
The *default* count that pre-fills the form when adding a new bottle. Not authoritative for any real bottle — each bottle carries its own count.
_Avoid_: bottle size, capacity (of a real bottle)

**Bottle price**:
What was paid for one specific bottle. Stored per bottle so cost is accurate as prices change over time.
_Avoid_: price (unqualified), cost

**Purchase link**:
Where a specific bottle was bought, stored per bottle since bottles may come from different stores. The supplement page aggregates the distinct links from its bottles ("Buy again").
_Avoid_: purchase URL (unqualified, the old supplement-level field)

**Cost per pill**:
A bottle's price ÷ its count. The **open bottle's** cost per pill is the current rate driving spend; it steps up as each bottle empties (FIFO).

**Quantity anchor** / **Anchored at**:
Per supplement, the pills-on-hand snapshot (distributed across bottles, oldest first) and the timestamp it was taken. Consumption is measured from here to now. The stored truth from which current per-bottle counts are computed.
_Avoid_: remaining, stock level

**On hand**:
Current total pills = sum across bottles of each bottle's remaining, where remaining is the anchor distribution minus consumption applied oldest-first. Computed, never stored.
_Avoid_: total, remaining, stock

**Open bottle** / **Sealed spare**:
The open bottle is the oldest bottle not yet emptied by consumption; sealed spares are the newer, still-full bottles behind it. Derived by walking bottles oldest-first (FIFO), not by dividing a blended total. An emptied bottle drops out of on hand but is kept as history.

**FIFO depletion** / **Auto-roll**:
Consumption drains the oldest bottle first; when it empties, the next bottle becomes the open one automatically. Falls out of the derivation — nothing to trigger, and "empty open bottle with a sealed spare waiting" is not a representable state.

**Re-anchor**:
Snapshotting each bottle's current remaining as its new anchor with anchored-at = now. Done on every real-world change: recounting/correcting a bottle, editing dosages, adding/removing a taker, adding a bottle, or changing a count. Freezes progress so a new rate applies only going forward.

### Spend

**Spend rate**:
The current cost of a habit, computed = consumption rate × cost per pill of the open bottle, shown per person and rolled up per household, in day / week / month windows. A forward-looking snapshot, not a historical record.
_Avoid_: cost, spend (unqualified)

**Lifetime spent**:
The sum of bottle prices ever logged for a supplement (or attributed to a person). Money actually paid, including bottles now empty. Distinct from spend rate.
_Avoid_: total cost

### People & usage

**Person**:
A household member who takes supplements.

**Dosage**:
How a person takes a supplement, stored as **pills per week**. Entry may be typed per-day, per-week, or by weekday, but all reduce to a weekly total.
_Avoid_: pills per dose, days per week (the old fixed-schedule model that couldn't express varying daily amounts)

**Consumption rate**:
Pills consumed per day for a supplement = (Σ each taker's pills-per-week) ÷ 7. Derived. A smooth daily average, not tied to specific weekdays.

**Run-out forecast**:
Projected days until on hand reaches zero = on hand ÷ consumption rate.
