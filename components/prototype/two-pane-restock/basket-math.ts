import {
  itemPrice,
  mockRetailers,
  money,
  perPill,
  selectedCandidate,
  type MockCandidate,
  type MockPlanItem,
  type MockRetailer,
} from "./mock-data";

export type BasketLine = {
  item: MockPlanItem;
  candidate: MockCandidate;
  unitPrice: number | null;
  lineTotal: number | null;
  perPill: string | null;
};

export type RetailerBasket = {
  retailer: MockRetailer;
  lines: BasketLine[];
  subtotal: number;
  complete: boolean;
  appliedShipping: number | null;
  allIn: number | null;
  shippingUnknown: boolean;
  gapToFreeShipping: number | null;
  freeShippingMet: boolean;
  thresholdUnset: boolean;
};

export function buildBaskets(items: MockPlanItem[], retailers = mockRetailers): RetailerBasket[] {
  const byRetailer = new Map<string, BasketLine[]>();

  for (const item of items) {
    const candidate = selectedCandidate(item);
    if (!candidate) continue;
    const unitPrice = itemPrice(item, candidate.id);
    const lineTotal = unitPrice !== null ? item.qty * unitPrice : null;
    const pill =
      unitPrice !== null && candidate.count
        ? perPill(unitPrice, candidate.count)
        : null;
    const lines = byRetailer.get(candidate.retailerId) ?? [];
    lines.push({ item, candidate, unitPrice, lineTotal, perPill: pill });
    byRetailer.set(candidate.retailerId, lines);
  }

  return retailers
    .filter((r) => byRetailer.has(r.id))
    .map((retailer) => {
      const lines = byRetailer.get(retailer.id)!;
      const subtotal = lines.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0);
      const complete = lines.every((l) => l.lineTotal !== null);
      const threshold = retailer.freeShippingThreshold;
      const thresholdUnset = threshold === undefined;
      const belowThreshold = thresholdUnset || subtotal < threshold!;
      const costSet = retailer.standardShippingCost !== undefined;
      const freeShippingMet = !thresholdUnset && subtotal >= threshold!;
      const shippingUnknown = belowThreshold && !costSet && !freeShippingMet;
      const appliedShipping = freeShippingMet
        ? 0
        : belowThreshold && costSet
          ? retailer.standardShippingCost!
          : null;
      const allIn =
        appliedShipping !== null && complete ? subtotal + appliedShipping : null;
      const gapToFreeShipping =
        threshold !== undefined && subtotal < threshold ? threshold - subtotal : null;

      return {
        retailer,
        lines,
        subtotal,
        complete,
        appliedShipping,
        allIn,
        shippingUnknown,
        gapToFreeShipping,
        freeShippingMet,
        thresholdUnset,
      };
    });
}

export function lowestPerPillIds(items: MockPlanItem[]): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const item of items) {
    const values = item.candidates
      .map((c) => {
        const price = itemPrice(item, c.id);
        if (price === null || !c.count) return null;
        return { id: c.id, v: price / c.count };
      })
      .filter(Boolean) as { id: string; v: number }[];
    if (values.length < 2) continue;
    const min = Math.min(...values.map((x) => x.v));
    result.set(item.id, new Set(values.filter((x) => x.v === min).map((x) => x.id)));
  }
  return result;
}

export function cheapestBasketIds(baskets: RetailerBasket[]): Set<string> {
  const eligible = baskets.filter(
    (b) => b.complete && !b.shippingUnknown && b.allIn !== null
  );
  if (eligible.length < 2) return new Set();
  const min = Math.min(...eligible.map((b) => b.allIn!));
  return new Set(eligible.filter((b) => b.allIn === min).map((b) => b.retailer.id));
}

export function unassignedCount(items: MockPlanItem[]) {
  return items.filter((i) => !i.selectedCandidateId).length;
}

export { money, perPill };
