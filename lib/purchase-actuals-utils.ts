export const MAX_BOTTLES_PER_PURCHASE = 100;

export interface PurchaseActualLine {
  itemId: string;
  qty: number;
  pricePerBottle: number;
  countPerBottle: number;
}

export function validatePurchaseActuals(
  purchasedAt: number,
  lines: PurchaseActualLine[]
): void {
  if (!Number.isFinite(purchasedAt)) {
    throw new Error("Invalid purchase date.");
  }

  const itemIds = new Set<string>();
  let totalBottles = 0;

  for (const line of lines) {
    if (itemIds.has(line.itemId)) {
      throw new Error("Each restock item may appear only once per purchase.");
    }
    itemIds.add(line.itemId);

    if (
      !Number.isFinite(line.qty) ||
      !Number.isInteger(line.qty) ||
      line.qty <= 0
    ) {
      throw new Error("Quantity must be a finite positive integer.");
    }
    if (
      !Number.isFinite(line.countPerBottle) ||
      !Number.isInteger(line.countPerBottle) ||
      line.countPerBottle <= 0
    ) {
      throw new Error("Count per bottle must be a finite positive integer.");
    }
    if (!Number.isFinite(line.pricePerBottle) || line.pricePerBottle < 0) {
      throw new Error("Price per bottle must be finite and nonnegative.");
    }

    totalBottles += line.qty;
    if (totalBottles > MAX_BOTTLES_PER_PURCHASE) {
      throw new Error(
        `A purchase may include at most ${MAX_BOTTLES_PER_PURCHASE} bottles.`
      );
    }
  }
}
