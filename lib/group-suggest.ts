/** Lowercase alphanumeric tokens for fuzzy name matching.
 *  Keep short nutrient codes (d3, k2, b12); drop other 1–2 letter noise. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 || (t.length >= 2 && /\d/.test(t)));
}

export interface GroupSuggestInput {
  _id: string;
  name: string;
  members: { name: string; brand?: string }[];
}

/**
 * Score how well a supplement name matches a group (higher = better).
 * Group name tokens weigh 2×; member name/brand tokens weigh 1×.
 */
export function scoreGroupMatch(
  supplementName: string,
  group: GroupSuggestInput
): number {
  const query = new Set(tokenize(supplementName));
  if (query.size === 0) return 0;

  let score = 0;
  const bump = (text: string, weight: number) => {
    for (const t of tokenize(text)) {
      if (query.has(t)) score += weight;
    }
  };

  bump(group.name, 2);
  for (const m of group.members) {
    bump(m.name, 1);
    if (m.brand) bump(m.brand, 1);
  }
  return score;
}

/** Best-scoring group above `minScore`, or null when nothing matches. */
export function suggestGroup(
  supplementName: string,
  groups: GroupSuggestInput[],
  minScore = 1
): GroupSuggestInput | null {
  let best: GroupSuggestInput | null = null;
  let bestScore = minScore - 1;
  for (const g of groups) {
    const s = scoreGroupMatch(supplementName, g);
    if (s > bestScore) {
      bestScore = s;
      best = g;
    }
  }
  return best;
}
