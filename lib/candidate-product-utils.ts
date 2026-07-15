/** Args carrying an optional solo supplement XOR group subject id. */
export type SubjectArgs = {
  supplementId?: string | null;
  groupId?: string | null;
};

/**
 * Require exactly one of supplementId or groupId. Returns which subject kind
 * was provided so callers can branch on index choice.
 */
export function validateSubjectXor(
  args: SubjectArgs
): "supplement" | "group" {
  const hasSupplement =
    args.supplementId !== undefined && args.supplementId !== null;
  const hasGroup = args.groupId !== undefined && args.groupId !== null;
  if (hasSupplement === hasGroup) {
    throw new Error("Exactly one of supplementId or groupId is required.");
  }
  return hasSupplement ? "supplement" : "group";
}

/** Literal trim used for stored URLs and dedupe comparison. */
export function normalizeCandidateUrl(url: string): string {
  return url.trim();
}

export type UrlComparable = { _id?: string; url: string };

/** True when another row on the subject already has the same trimmed URL. */
export function hasDuplicateUrl(
  candidates: UrlComparable[],
  url: string,
  excludeId?: string
): boolean {
  const normalized = normalizeCandidateUrl(url);
  if (!normalized) return false;
  return candidates.some(
    (candidate) =>
      normalizeCandidateUrl(candidate.url) === normalized &&
      candidate._id !== excludeId
  );
}
