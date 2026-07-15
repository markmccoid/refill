import { normalizeCandidateUrl } from "./candidate-product-utils";

export type SeedSource = {
  supplementId: string;
  retailerId: string;
  url: string;
  label: string;
  count?: number;
};

export type SavedLinkInput = {
  supplementId: string;
  retailerId: string;
  url: string;
};

export type BottleInput = {
  supplementId: string;
  retailerId?: string | null;
  purchaseUrl?: string | null;
  count: number;
  purchasedAt: number;
};

export type SupplementInput = {
  id: string;
  name: string;
  jarSize: number;
};

function positiveCount(count: number | undefined): number | undefined {
  if (count === undefined || !Number.isFinite(count) || count <= 0) {
    return undefined;
  }
  return count;
}

/** Most recent bottle count for supplement×retailer, else any recent bottle, else jar size. */
export function pickBottleCount(
  supplement: SupplementInput,
  bottles: BottleInput[],
  retailerId: string
): number | undefined {
  const forSupplement = bottles.filter((b) => b.supplementId === supplement.id);
  const byRecency = [...forSupplement].sort(
    (a, b) => b.purchasedAt - a.purchasedAt
  );

  const forRetailer = byRecency.find((b) => b.retailerId === retailerId);
  const fromRetailer = positiveCount(forRetailer?.count);
  if (fromRetailer !== undefined) return fromRetailer;

  const fromAny = positiveCount(byRecency[0]?.count);
  if (fromAny !== undefined) return fromAny;

  return positiveCount(supplement.jarSize);
}

function retailerIdsForSupplement(
  supplementId: string,
  savedLinks: SavedLinkInput[],
  bottles: BottleInput[]
): string[] {
  const ids = new Set<string>();
  for (const link of savedLinks) {
    if (link.supplementId === supplementId) ids.add(link.retailerId);
  }
  for (const bottle of bottles) {
    if (bottle.supplementId === supplementId && bottle.retailerId) {
      ids.add(bottle.retailerId);
    }
  }
  return [...ids];
}

function mostRecentBottleUrl(
  supplementId: string,
  retailerId: string,
  bottles: BottleInput[]
): string | undefined {
  const match = bottles
    .filter(
      (b) =>
        b.supplementId === supplementId &&
        b.retailerId === retailerId &&
        b.purchaseUrl?.trim()
    )
    .sort((a, b) => b.purchasedAt - a.purchasedAt)[0];
  const url = match?.purchaseUrl?.trim();
  return url || undefined;
}

/**
 * Saved links plus bottle URL fallback (most recent per supplement×retailer when
 * no saved link) for one supplement.
 */
export function collectSeedSourcesForSupplement(
  supplement: SupplementInput,
  savedLinks: SavedLinkInput[],
  bottles: BottleInput[]
): SeedSource[] {
  const sources: SeedSource[] = [];
  const linksForSupplement = savedLinks.filter(
    (l) => l.supplementId === supplement.id
  );
  const linkByRetailer = new Map(
    linksForSupplement.map((l) => [l.retailerId, l])
  );

  for (const retailerId of retailerIdsForSupplement(
    supplement.id,
    savedLinks,
    bottles
  )) {
    const saved = linkByRetailer.get(retailerId);
    const url = saved
      ? normalizeCandidateUrl(saved.url)
      : mostRecentBottleUrl(supplement.id, retailerId, bottles);
    if (!url) continue;

    sources.push({
      supplementId: supplement.id,
      retailerId,
      url,
      label: supplement.name.trim(),
      count: pickBottleCount(supplement, bottles, retailerId),
    });
  }

  return sources;
}

/**
 * Aggregate seed sources from all group members; dedupe by URL within the batch
 * (first source wins for label/count metadata).
 */
export function collectSeedSourcesForGroup(
  members: SupplementInput[],
  savedLinks: SavedLinkInput[],
  bottles: BottleInput[]
): SeedSource[] {
  const combined: SeedSource[] = [];
  for (const member of members) {
    combined.push(
      ...collectSeedSourcesForSupplement(member, savedLinks, bottles)
    );
  }
  return dedupeSeedSourcesByUrl(combined);
}

/** Drop sources whose URL already exists on the subject or duplicates earlier in batch. */
export function filterNovelSeedSources(
  sources: SeedSource[],
  existingUrls: Iterable<string>
): SeedSource[] {
  const seen = new Set<string>();
  for (const url of existingUrls) {
    const normalized = normalizeCandidateUrl(url);
    if (normalized) seen.add(normalized);
  }

  const novel: SeedSource[] = [];
  for (const source of sources) {
    const normalized = normalizeCandidateUrl(source.url);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    novel.push({ ...source, url: normalized });
  }
  return novel;
}

export function countNovelSeedSources(
  sources: SeedSource[],
  existingUrls: Iterable<string>
): number {
  return filterNovelSeedSources(sources, existingUrls).length;
}

function dedupeSeedSourcesByUrl(sources: SeedSource[]): SeedSource[] {
  const seen = new Set<string>();
  const deduped: SeedSource[] = [];
  for (const source of sources) {
    const normalized = normalizeCandidateUrl(source.url);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push({ ...source, url: normalized });
  }
  return deduped;
}
