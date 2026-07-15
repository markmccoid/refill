"use client";

import { useState } from "react";
import {
  buildBaskets,
  cheapestBasketIds,
  lowestPerPillIds,
  money,
  perPill,
  unassignedCount,
  type RetailerBasket,
} from "./basket-math";
import {
  initialPlanItems,
  itemPrice,
  mockRetailers,
  retailerName,
  selectedCandidate,
  type MockPlanItem,
} from "./mock-data";

export function useRestockPrototypeState(initial = initialPlanItems) {
  const [items, setItems] = useState(initial);
  const baskets = buildBaskets(items);
  const lowestPill = lowestPerPillIds(items);
  const cheapest = cheapestBasketIds(baskets);
  return { items, setItems, baskets, lowestPill, cheapest, unassigned: unassignedCount(items) };
}

export function StateDump({
  items,
  baskets,
  cheapest,
}: {
  items: MockPlanItem[];
  baskets: RetailerBasket[];
  cheapest: Set<string>;
}) {
  return (
    <pre className="text-[11px] bg-surface-alt border border-border rounded-lg p-3 overflow-auto max-h-48">
      {JSON.stringify(
        {
          items: items.map((i) => ({
            id: i.id,
            selected: i.selectedCandidateId,
            prices: i.priceByCandidateId,
          })),
          baskets: baskets.map((b) => ({
            retailer: b.retailer.name,
            subtotal: b.subtotal,
            shipping: b.appliedShipping,
            allIn: b.allIn,
            complete: b.complete,
            shippingUnknown: b.shippingUnknown,
            cheapest: cheapest.has(b.retailer.id),
          })),
        },
        null,
        2
      )}
    </pre>
  );
}

export function ShippingStatus({ basket }: { basket: RetailerBasket }) {
  const { retailer, gapToFreeShipping, freeShippingMet, thresholdUnset, subtotal } = basket;
  if (thresholdUnset) {
    return (
      <p className="text-[11px] text-text-muted">Free-shipping threshold not set</p>
    );
  }
  if (freeShippingMet) {
    return (
      <p className="text-[11px] text-primary font-semibold">
        ✓ Free shipping met ({money(retailer.freeShippingThreshold!)})
      </p>
    );
  }
  if (gapToFreeShipping !== null && gapToFreeShipping > 0) {
    return (
      <div>
        <p className="text-[11px] text-low font-semibold">
          {money(gapToFreeShipping)} to free shipping ({money(retailer.freeShippingThreshold!)})
        </p>
        <div className="mt-1 h-1.5 bg-text/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-low rounded-full"
            style={{
              width: `${Math.min(100, (subtotal / retailer.freeShippingThreshold!) * 100)}%`,
            }}
          />
        </div>
      </div>
    );
  }
  return null;
}

export function BasketTotals({ basket }: { basket: RetailerBasket }) {
  return (
    <div className="space-y-1 text-sm">
      <div className="flex justify-between">
        <span className="text-text-muted">Subtotal</span>
        <span className="font-medium">{money(basket.subtotal)}</span>
      </div>
      {basket.appliedShipping !== null && (
        <div className="flex justify-between text-xs">
          <span className="text-text-muted">Shipping</span>
          <span>{basket.appliedShipping === 0 ? "Free" : money(basket.appliedShipping)}</span>
        </div>
      )}
      {basket.shippingUnknown && (
        <p className="text-[11px] text-amber-700 font-medium">Shipping cost unknown</p>
      )}
      {basket.allIn !== null && (
        <div className="flex justify-between font-bold border-t border-border pt-1.5">
          <span>All-in</span>
          <span>{money(basket.allIn)}</span>
        </div>
      )}
      {!basket.complete && (
        <p className="text-[11px] text-text-muted">Incomplete — missing price(s)</p>
      )}
    </div>
  );
}

export function updateItemSelection(
  items: MockPlanItem[],
  itemId: string,
  candidateId: string
): MockPlanItem[] {
  return items.map((item) =>
    item.id === itemId
      ? {
          ...item,
          selectedCandidateId:
            item.selectedCandidateId === candidateId ? null : candidateId,
        }
      : item
  );
}

export function updateItemPrice(
  items: MockPlanItem[],
  itemId: string,
  candidateId: string,
  price: number | null
): MockPlanItem[] {
  return items.map((item) => {
    if (item.id !== itemId) return item;
    const next = { ...item.priceByCandidateId };
    if (price === null) delete next[candidateId];
    else next[candidateId] = price;
    return { ...item, priceByCandidateId: next };
  });
}

export function updateItemQty(items: MockPlanItem[], itemId: string, qty: number): MockPlanItem[] {
  return items.map((item) => (item.id === itemId ? { ...item, qty } : item));
}

export {
  itemPrice,
  mockRetailers,
  money,
  perPill,
  retailerName,
  selectedCandidate,
  type MockPlanItem,
};
