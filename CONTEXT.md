# Refill

A household supplement-inventory tracker: what supplements people take, how much is on hand, when each will run out, and what it costs. Pill counts deplete over time automatically by computing consumption from an anchored snapshot — there is no scheduled job.

## Language

### Inventory

**Supplement**:
A distinct product a household stocks (e.g. "B-Right" by Jarrow). One entry, regardless of how many physical bottles are on hand. May belong to a **Group** when it's one interchangeable brand of a broader role.
_Avoid_: pill, vitamin (those are kinds of supplements, not the entry)

**Group**:
An interchangeable set of Supplements (brands) that fill the same role — e.g. "Fish Oil" spanning Brand A and Brand B. Consumed **one brand at a time in sequence**; owns the combined run-out forecast, cost roll-up, per-person dosage, and the anchor clock. A Supplement belongs to at most one Group. Carries its own **user-set name** (the role — no brand carries it) and an optional **category**; its dashboard image is the **currently-open brand's image** (so it reflects what's being taken now and changes at each rollover). Holds **at least two members** — it forms by linking ≥2 brands, and **auto-dissolves** back to a solo Supplement when unlinked down to one. Membership changes (link / unlink) are re-anchor events.
_Avoid_: stack (means *different* supplements taken together — the opposite), bundle, category (that's a field on the group, not a synonym), regimen (that's a person's whole set of supplements)

**Group queue** / **Consumption order**:
The single ordered list of every bottle across a Group's brands, drained **oldest-purchase-first** (pooled FIFO) with the currently-open bottle pinned to the front. A newly added bottle lands by its purchase date (newest at the back), so a new bottle of an earlier brand still waits behind bottles bought before it. The order can be manually overridden when real-world intent differs from purchase dates.
_Avoid_: sequence (unqualified), priority

**Group dosage** / **Per-brand override**:
Dosage is set once per person on the **Group** (pills per week) and inherited by every brand in it. A brand may carry an optional **override** for the rare case where its pill count differs (e.g. a half-strength brand needs two pills instead of one). With no overrides present, the Group depletes at one constant rate; an override makes the Group's rate **piecewise** — it changes as the queue rolls from one brand to the next.
_Avoid_: setting dosage per brand by default

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

**Retailer**:
A store the household buys supplements from (e.g. Amazon, Vitacost), known household-wide. Carries an optional **free-shipping threshold** and optional **standard shipping cost** (the flat fee below that threshold). Both unset mean "unknown", not zero. Bottles record which Retailer they came from; a household can know a Retailer it has never bought from yet.
_Avoid_: site (the old scraping-era framing), store, vendor, shop

**Purchase link**:
Where a specific bottle was bought, stored per bottle since bottles may come from different stores. The supplement page aggregates the distinct links from its bottles ("Buy again").
_Avoid_: purchase URL (unqualified, the old supplement-level field)

**Saved purchase link**:
A remembered URL for buying a given Supplement at a given Retailer — the product page you'd reopen to restock. One per supplement-retailer pair; exists independently of whether a bottle was ever bought there. Written two ways: directly in the planner, or automatically when a bottle is logged with a purchase link (the most recent purchase's URL wins). Distinct from a bottle's **purchase link**, which records where one physical bottle actually came from. Also distinct from a **Candidate Product** — saved links may seed candidates on a subject but are not themselves comparison options in the Restock UI.
_Avoid_: conflating with the per-bottle purchase link, conflating with a Candidate Product

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

### Restocking

**Restock Plan**:
The household's single active purchasing worksheet: the supplements to buy this cycle, each with a **selected candidate**, entered price, and planned quantity. Membership is **user-curated only** — items are picked from a run-out-ordered list of the household's supplements; the forecast informs the pick (ordering, urgency badge) but never adds or removes items itself. Persists until its items are purchased or removed — there is no explicit "start"/"end" action.
_Avoid_: cart (nothing is transacted in-app), shopping list (unqualified), buy list, auto-population (rejected — the plan only contains what the user chose)

**Restock item**:
One line of the Restock Plan. Its subject is what runs out — a solo Supplement or a whole Group — never an individual grouped brand. Fulfilling an item means **selecting one candidate** from that subject's list; the purchase lands via **match-or-add** to a Supplement (existing or new) at **Mark as Purchased**. The recommended quantity is computed from the subject's consumption rate and the selected candidate's count.
_Avoid_: listing grouped brands as separate items

**Candidate Product**:
A durable purchasable option attached to a restock **subject** (solo Supplement or Group) — not to the Restock Plan or an individual grouped brand. Carries **Retailer**, **URL**, **label** (freeform product display name — not a Supplement name), and **count** (bottle size for $/pill on this product). Many per subject; not locked to brands currently in inventory — substitutes and brands never yet stocked are allowed. On a solo subject, a substitute at a different brand becomes a **new Supplement** at purchase time (with an optional offer to form a **Group** — always shown, user decides). One candidate per URL per subject (literal URL match; edit in place to update). **Label** is required; **count** is required for $/pill comparison but a candidate may be saved or even selected without it (subtotal still works; $/pill nudges skip until count is set). Exactly one candidate may be **selected** per Restock item per cycle; entered price and planned quantity live on the Restock item, not on the candidate. Deleted when the subject is deleted; unaffected when a Restock item is removed from the plan. When Supplements form or join a Group, their candidates migrate to the Group and dedupe by URL. When a Group auto-dissolves to one member, candidates **migrate** to the surviving solo Supplement with the same URL-only dedupe; on full Group teardown, deleted with the Group. Distinct from a **Saved purchase link** — that remains per (Supplement, Retailer) and may seed candidates but does not participate in comparison UI. Replaces the old **Offer** matrix.
_Avoid_: offer (retired term), quote (the dead scraping-era concept), binding a candidate to a Supplement before purchase

**Restock session**:
The lifespan of the active Restock Plan — from first item to last item purchased or removed. Entered prices live only within it; a completed or removed item's prices are discarded, not carried into the next cycle.
_Avoid_: browser session (it survives reloads and devices)

**Retailer order**:
The derived grouping of a plan's selected items by Retailer: items, quantities, entered prices, **subtotal** (sum of priced lines only — unpriced lines show "no price" and do not contribute), **applied shipping** (the Retailer's standard shipping cost when the basket is below free-shipping threshold or the threshold is unset; zero when threshold is met), and **all-in total** (subtotal + applied shipping). Also carries free-shipping status: gap to threshold (on subtotal only — shipping does not affect the gap), threshold met, threshold not set, or shipping unknown (below threshold but no standard shipping cost on the Retailer). A basket is **complete** when every line has an entered price; **shipping-known** when not shipping-unknown. Computed from the items, never stored. **Mark as Purchased** acts on one Retailer order, with a confirmation that lets actuals (price, count, quantity, inclusion) differ from the plan. Restock **nudges** (informational only): **cheapest basket** among complete, shipping-known baskets with an all-in total; gap / free-shipping-met per retailer when threshold is set.
_Avoid_: order (unqualified), cart

**Forecast window**:
Household setting (default 30 days) for *urgency signalling only*: the Restock badge count and the picker's highlighting. Never adds anything to the plan.
_Avoid_: forecast period (ambiguous with coverage)

**Coverage target**:
Household setting (default 90 days) driving the **recommended quantity**: enough bottles that, after purchase, on hand covers the target at the current consumption rate — `max(1, ceil((rate × coverageDays − onHand) / bottleCount))`. A suggestion; the planned quantity is always editable.
_Avoid_: stock-up horizon, forecast window (the other knob)

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
