import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

/**
 * The signed-in user's household id, or null while loading / before setup.
 *
 * Replaces the old localStorage demo household (which seeded sample supplements
 * whenever storage was empty — the source of the "my data reset to Fish Oil +
 * K2" bug). On first sign-in, if the user has no household yet, this creates an
 * empty one (+ owner membership) exactly once. No sample data is seeded.
 */
export function useHousehold(): Id<"households"> | null {
  const { isAuthenticated } = useConvexAuth();
  const current = useQuery(
    api.households.currentHousehold,
    isAuthenticated ? {} : "skip"
  );
  const ensure = useMutation(api.households.ensureForCurrentUser);
  const ensuring = useRef(false);

  useEffect(() => {
    // Authenticated but no household row yet → create one (once).
    if (isAuthenticated && current === null && !ensuring.current) {
      ensuring.current = true;
      ensure({}).catch(() => {
        ensuring.current = false; // allow retry on failure
      });
    }
  }, [isAuthenticated, current, ensure]);

  return current ? current.householdId : null;
}
