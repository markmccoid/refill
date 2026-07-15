// All-in retailer basket math + soft nudges (ADR-0009).
// Pure — shared by Convex and the client. No React / Convex imports.

export type BasketLineInput = {
  qty: number;
  enteredPrice: number | null;
  candidateCount: number | null;
};

export type BasketLineResult = {
  unitPrice: number | null;
  /** null means "no price" — does not contribute to subtotal. */
  lineTotal: number | null;
  /** Sticker-only: enteredPrice ÷ candidateCount. Never allocates shipping. */
  perPill: number | null;
};

export type RetailerShippingConfig = {
  /** Unset = unknown, not zero. */
  freeShippingThreshold?: number;
  /** Unset = unknown, not zero. */
  standardShippingCost?: number;
};

export type RetailerBasketResult = {
  subtotal: number;
  complete: boolean;
  /** Dollar amount applied, 0 when free shipping met, null when unknown. */
  appliedShipping: number | null;
  /** subtotal + appliedShipping when complete and shipping known; else null. */
  allIn: number | null;
  shippingUnknown: boolean;
  /** threshold − subtotal when threshold set and unmet; else null. */
  gapToFreeShipping: number | null;
  freeShippingMet: boolean;
  thresholdUnset: boolean;
};

export type CandidatePriceInput = {
  candidateId: string;
  enteredPrice: number | null;
  count: number | null;
};

export type BasketForNudge = {
  retailerId: string;
  complete: boolean;
  shippingUnknown: boolean;
  allIn: number | null;
};

/** Round money to cents — avoids IEEE float noise on dollar totals. */
function cents(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Per-line totals and sticker $/pill. Shipping is never allocated to pills. */
export function buildBasketLines(lines: BasketLineInput[]): BasketLineResult[] {
  return lines.map((line) => {
    const unitPrice = line.enteredPrice;
    const lineTotal =
      unitPrice !== null && Number.isFinite(unitPrice)
        ? cents(line.qty * unitPrice)
        : null;
    const perPill =
      unitPrice !== null &&
      Number.isFinite(unitPrice) &&
      line.candidateCount !== null &&
      line.candidateCount > 0
        ? unitPrice / line.candidateCount
        : null;
    return { unitPrice, lineTotal, perPill };
  });
}

/**
 * Aggregate a retailer's selected lines into subtotal / shipping / all-in.
 * Rules (ADR-0009 / ticket 02):
 * - Subtotal = sum of priced lines only
 * - Complete = every line has an entered price
 * - Applied shipping = standard cost when (threshold unset OR below threshold)
 *   and cost is set; $0 when threshold met; null when shipping unknown
 * - All-in only when complete and shipping known
 * - Gap uses subtotal only
 */
export function computeRetailerBasket(
  lines: BasketLineInput[],
  shipping: RetailerShippingConfig
): RetailerBasketResult {
  const built = buildBasketLines(lines);
  const subtotal = cents(
    built.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0)
  );
  const complete = built.every((l) => l.lineTotal !== null);

  const threshold = shipping.freeShippingThreshold;
  const thresholdUnset = threshold === undefined;
  const costSet = shipping.standardShippingCost !== undefined;
  const freeShippingMet = !thresholdUnset && subtotal >= threshold!;
  const belowThreshold = thresholdUnset || subtotal < threshold!;

  const shippingUnknown = belowThreshold && !costSet && !freeShippingMet;
  const appliedShipping = freeShippingMet
    ? 0
    : belowThreshold && costSet
      ? cents(shipping.standardShippingCost!)
      : null;

  const allIn =
    appliedShipping !== null && complete
      ? cents(subtotal + appliedShipping)
      : null;

  const gapToFreeShipping =
    threshold !== undefined && subtotal < threshold
      ? cents(threshold - subtotal)
      : null;

  return {
    subtotal,
    complete,
    appliedShipping,
    allIn,
    shippingUnknown,
    gapToFreeShipping,
    freeShippingMet,
    thresholdUnset,
  };
}

/**
 * Lowest $/pill among candidates that have both entered price and count.
 * Returns empty when fewer than 2 qualify; ties return all tied ids.
 */
export function lowestPerPillCandidateIds(
  candidates: CandidatePriceInput[]
): string[] {
  const priced = candidates
    .map((c) => {
      if (
        c.enteredPrice === null ||
        !Number.isFinite(c.enteredPrice) ||
        c.count === null ||
        c.count <= 0
      ) {
        return null;
      }
      return { id: c.candidateId, perPill: c.enteredPrice / c.count };
    })
    .filter(Boolean) as { id: string; perPill: number }[];

  if (priced.length < 2) return [];

  const min = Math.min(...priced.map((p) => p.perPill));
  return priced.filter((p) => p.perPill === min).map((p) => p.id);
}

/**
 * Cheapest all-in among complete, shipping-known baskets.
 * Returns empty when fewer than 2 eligible; ties return all tied retailer ids.
 */
export function cheapestBasketRetailerIds(
  baskets: BasketForNudge[]
): string[] {
  const eligible = baskets.filter(
    (b) => b.complete && !b.shippingUnknown && b.allIn !== null
  );
  if (eligible.length < 2) return [];

  const min = Math.min(...eligible.map((b) => b.allIn!));
  return eligible.filter((b) => b.allIn === min).map((b) => b.retailerId);
}
