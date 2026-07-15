export interface CandidatePrice<CandidateId extends string = string> {
  candidateId: CandidateId;
  price: number;
}

export function lookupCandidatePrice<CandidateId extends string>(
  prices: CandidatePrice<CandidateId>[] | undefined,
  candidateId: CandidateId
): number | null {
  const stored = prices?.find(
    (entry) => entry.candidateId === candidateId
  );
  return stored?.price ?? null;
}

export function upsertCandidatePrice<CandidateId extends string>(
  prices: CandidatePrice<CandidateId>[] | undefined,
  candidateId: CandidateId,
  price: number
): CandidatePrice<CandidateId>[] {
  const next = [...(prices ?? [])];
  const index = next.findIndex((entry) => entry.candidateId === candidateId);
  const entry = { candidateId, price };
  if (index === -1) next.push(entry);
  else next[index] = entry;
  return next;
}

export function clearCandidatePrice<CandidateId extends string>(
  prices: CandidatePrice<CandidateId>[] | undefined,
  candidateId: CandidateId
): CandidatePrice<CandidateId>[] {
  return (prices ?? []).filter((entry) => entry.candidateId !== candidateId);
}

/**
 * Remap a source cycle's prices into an existing target cycle.
 * The retained target cycle always wins. Within one source cycle, its selected
 * candidate wins when multiple source candidates remap to the same target.
 */
export function remapAndMergeCandidatePrices<CandidateId extends string>(
  targetPrices: CandidatePrice<CandidateId>[] | undefined,
  sourcePrices: CandidatePrice<CandidateId>[] | undefined,
  selectedSourceCandidateId: CandidateId | undefined,
  remapCandidateId: (candidateId: CandidateId) => CandidateId | undefined
): CandidatePrice<CandidateId>[] {
  const merged = [...(targetPrices ?? [])];
  const prioritizedSource = [...(sourcePrices ?? [])].sort((a, b) => {
    const aSelected = a.candidateId === selectedSourceCandidateId ? 1 : 0;
    const bSelected = b.candidateId === selectedSourceCandidateId ? 1 : 0;
    return bSelected - aSelected;
  });
  for (const entry of prioritizedSource) {
    const targetId = remapCandidateId(entry.candidateId);
    if (targetId === undefined) continue;
    if (
      !merged.some(
        (candidatePrice) => candidatePrice.candidateId === targetId
      )
    ) {
      merged.push({ candidateId: targetId, price: entry.price });
    }
  }
  return merged;
}

export function lowestPricePerPillCandidateIds<CandidateId extends string>(
  candidates: Array<{
    candidateId: CandidateId;
    count: number | null | undefined;
    price: number | null | undefined;
  }>
): CandidateId[] {
  let lowest = Infinity;
  const ids: CandidateId[] = [];
  let comparableCount = 0;
  for (const candidate of candidates) {
    if (
      candidate.price === null ||
      candidate.price === undefined ||
      !Number.isFinite(candidate.price) ||
      candidate.price < 0 ||
      candidate.count === null ||
      candidate.count === undefined ||
      !Number.isFinite(candidate.count) ||
      candidate.count <= 0
    ) {
      continue;
    }
    comparableCount++;
    const perPill = candidate.price / candidate.count;
    if (perPill < lowest) {
      lowest = perPill;
      ids.splice(0, ids.length, candidate.candidateId);
    } else if (perPill === lowest) {
      ids.push(candidate.candidateId);
    }
  }
  return comparableCount >= 2 ? ids : [];
}
