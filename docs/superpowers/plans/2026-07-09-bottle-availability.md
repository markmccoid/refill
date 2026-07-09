# Bottle Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make future-dated bottles incoming stock that is visible but not available for depletion until its available date.

**Architecture:** Keep the existing bottle date field as the implementation storage for the available date. Centralize availability behavior in `lib/supplement-utils.ts` so dashboard, supplement list/detail, costs, groups, and restock share the same ledger rules. Add lightweight TypeScript tests for the pure ledger helpers before changing production code.

**Tech Stack:** Next.js, React, Convex, TypeScript, Node test runner with `tsx` from existing dependency tree.

---

## File Map

- Modify `lib/supplement-utils.ts`: split bottle ledger into available and incoming portions, pause depletion when no available stock exists, expose incoming totals for callers.
- Create `tests/supplement-utils.test.ts`: pure TypeScript tests for future availability, no pill debt, same-day ordering, and group pooling.
- Modify `package.json`: add a `test` script that runs the TypeScript tests.
- Modify `components/BottleFields.tsx`: change user-facing label/helper text from purchased date to available date.
- Modify `components/RunOutTimeline.tsx`: show incoming stock as a separate labeled segment/marker.
- Modify `app/(app)/dashboard/page.tsx`: pass incoming counts to the timeline and keep current status based on available stock only.
- Modify `components/SupplementListItem.tsx`: show incoming stock context without counting it as on hand.
- Modify `app/(app)/supplements/[id]/page.tsx`: align labels and bottle ledger display with available/incoming language.
- Modify `convex/restock.ts`: include incoming stock in subject state and recommended quantity while preserving urgency from available stock.
- Modify `app/(app)/restock/page.tsx`: display available plus incoming stock in plan rows.

## Tasks

### Task 1: Add failing pure ledger tests

**Files:**
- Create: `tests/supplement-utils.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add `test` script**

Add:

```json
"test": "tsx --test tests/**/*.test.ts"
```

- [ ] **Step 2: Write failing tests**

Create tests covering:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  getBottleStates,
  getGroupState,
  type BottleLike,
} from "../lib/supplement-utils";

const day = 86_400_000;
const jan1 = Date.UTC(2026, 0, 1, 12);

function bottle(
  count: number,
  availableOffsetDays: number,
  remaining = count
): BottleLike {
  return {
    count,
    price: count,
    purchasedAt: jan1 + availableOffsetDays * day,
    remainingAtAnchor: remaining,
  };
}

test("future bottles are incoming and do not deplete before available date", () => {
  const ledger = getBottleStates([bottle(30, 3)], jan1, 2, jan1 + 2 * day);
  assert.equal(ledger.onHand, 0);
  assert.equal(ledger.incomingCount, 30);
  assert.equal(ledger.bottleCount, 0);
  assert.equal(ledger.openCostPerPill, 0);
});

test("future bottles do not accrue pill debt while unavailable", () => {
  const ledger = getBottleStates([bottle(30, 3)], jan1, 2, jan1 + 5 * day);
  assert.equal(ledger.onHand, 26);
  assert.equal(ledger.incomingCount, 0);
  assert.equal(ledger.openRemaining, 26);
});

test("available bottles drain before future bottles join the queue", () => {
  const ledger = getBottleStates(
    [bottle(10, 0), bottle(30, 5)],
    jan1,
    2,
    jan1 + 6 * day
  );
  assert.equal(ledger.onHand, 28);
  assert.equal(ledger.states[0].remaining, 0);
  assert.equal(ledger.states[1].remaining, 28);
});

test("group state treats member future bottles as incoming", () => {
  const ledger = getGroupState(
    [
      { supplementId: "a", bottles: [bottle(10, 0)] },
      { supplementId: "b", bottles: [bottle(30, 3)] },
    ],
    jan1,
    2,
    jan1 + day
  );
  assert.equal(ledger.onHand, 8);
  assert.equal(ledger.incomingCount, 30);
  assert.equal(ledger.openSupplementId, "a");
});
```

- [ ] **Step 3: Run tests and verify failure**

Run: `npm test`

Expected: tests fail because `incomingCount` does not exist and future bottles are still included in current depletion.

### Task 2: Implement availability-aware ledger helpers

**Files:**
- Modify: `lib/supplement-utils.ts`

- [ ] **Step 1: Update ledger types**

Add `incomingCount`, `incomingBottles`, and `nextIncomingAt` to `LedgerState`.

- [ ] **Step 2: Update `getBottleStates`**

Implement event-based depletion:

```ts
let cursor = anchoredAt;
let available = ordered.filter((b) => b.purchasedAt <= cursor);
for (const next of ordered.filter((b) => b.purchasedAt > cursor)) {
  const segmentEnd = Math.min(next.purchasedAt, now);
  drain available bottles for segmentEnd - cursor;
  cursor = segmentEnd;
  if (cursor >= next.purchasedAt && cursor <= now) add next to available queue;
}
drain available bottles for now - cursor;
```

The actual implementation should preserve the existing return shape and state ordering while ensuring future bottles do not lose pills before `purchasedAt`.

- [ ] **Step 3: Update `getGroupState`**

No special group algorithm should be needed beyond propagating the new ledger fields from `getBottleStates`.

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: PASS.

### Task 3: Update bottle date UI language

**Files:**
- Modify: `components/BottleFields.tsx`
- Modify: `app/(app)/supplements/[id]/page.tsx`

- [ ] **Step 1: Change form label**

Change `Purchased` to `Available date`.

- [ ] **Step 2: Add helper text**

Add concise text under the date input:

```tsx
<p className="mt-1 text-[11px] font-normal text-text-muted">
  Future dates are incoming and will not be used until then.
</p>
```

- [ ] **Step 3: Update detail page edit labels**

Any visible date labels for bottle editing/history should say `Available` or `Available date` when describing depletion timing.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: TypeScript and Next build pass.

### Task 4: Surface incoming stock on dashboard and list rows

**Files:**
- Modify: `components/RunOutTimeline.tsx`
- Modify: `app/(app)/dashboard/page.tsx`
- Modify: `components/SupplementListItem.tsx`

- [ ] **Step 1: Extend `TimelineRow`**

Add:

```ts
incomingCount?: number;
nextIncomingAt?: number | null;
```

- [ ] **Step 2: Render incoming graph context**

Show an incoming segment/marker in a distinct color with label `Incoming`. It must not change `daysLeft` or the normal run-out bar width.

- [ ] **Step 3: Pass incoming fields from dashboard**

Use `ledger.incomingCount` and `ledger.nextIncomingAt` for solo and group rows.

- [ ] **Step 4: Show incoming copy on supplement list rows**

When `ledger.incomingCount > 0`, append `+ N incoming` after the on-hand text.

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: PASS.

### Task 5: Update restock state and display

**Files:**
- Modify: `convex/restock.ts`
- Modify: `app/(app)/restock/page.tsx`

- [ ] **Step 1: Add incoming fields to `SubjectState` and validators**

Add `incomingCount: number` to subject state and query returns.

- [ ] **Step 2: Recommended quantity counts incoming**

Call `getRecommendedQty(rate, onHand + incomingCount, jarSize, coverageTargetDays)`.

- [ ] **Step 3: Display split in restock UI**

Show `N available + M incoming` when incoming exists; otherwise keep `N on hand`.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS.

### Task 6: Final verification

**Files:**
- All touched files

- [ ] **Step 1: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Inspect git diff**

Run: `git diff --stat`

Expected: only spec, plan, tests, ledger helpers, and targeted UI/restock files changed.

## Self-Review

- Spec coverage: The plan covers available/incoming separation, no pill debt, groups, dashboard, restock, UI copy, and current spend/status implications through the shared ledger helper.
- Placeholder scan: No task contains TBD/TODO placeholders.
- Type consistency: The plan consistently uses `incomingCount` and `nextIncomingAt` as new ledger fields.
