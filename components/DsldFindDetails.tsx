"use client";

import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

export type DsldLabel = FunctionReturnType<typeof api.dsld.getLabel>;
type SearchHit = FunctionReturnType<typeof api.dsld.search>[number];

export interface DsldFindDetailsHandle {
  open: () => void;
}

interface DsldFindDetailsProps {
  initialQuery: string;
  onApply: (label: DsldLabel) => void;
  buttonLabel?: string;
  buttonClassName?: string;
}

export const DsldFindDetails = forwardRef<
  DsldFindDetailsHandle,
  DsldFindDetailsProps
>(function DsldFindDetails(
  {
    initialQuery,
    onApply,
    buttonLabel = "Find Details",
    buttonClassName = "btn-outline whitespace-nowrap",
  },
  ref
) {
  const [open, setOpen] = useState(false);

  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName}
      >
        {buttonLabel}
      </button>
      {open && (
        <DsldLookupModal
          initialQuery={initialQuery}
          onClose={() => setOpen(false)}
          onApply={(label) => {
            onApply(label);
            setOpen(false);
          }}
        />
      )}
    </>
  );
});

function DsldLookupModal({
  initialQuery,
  onClose,
  onApply,
}: {
  initialQuery: string;
  onClose: () => void;
  onApply: (label: DsldLabel) => void;
}) {
  const searchDsld = useAction(api.dsld.search);
  const getLabel = useAction(api.dsld.getLabel);

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      setIsLoading(true);
      setError(null);
      setResults([]);
      setHasSearched(true);
      try {
        const hits = await searchDsld({ query: q, size: 20 });
        setResults(hits);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Search failed. Check your connection."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [searchDsld]
  );

  // Seed the search with the supplement name on open.
  useEffect(() => {
    if (initialQuery.trim()) runSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = async (hit: SearchHit) => {
    setSelectingId(hit.dsldId);
    setError(null);
    try {
      const label = await getLabel({ dsldId: hit.dsldId });
      console.log("DSLD label (parsed):", label);
      onApply(label);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load product details"
      );
      setSelectingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 bg-surface rounded-lg max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-card">
        {/* Header */}
        <div className="border-b border-black/10 p-6 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold">Find supplement details</h2>
            <p className="text-xs text-text-muted mt-0.5">
              From the NIH Dietary Supplement Label Database (DSLD)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Search bar */}
        <div className="p-6 border-b border-black/10 flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by product or brand name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch(query)}
              className="flex-1 px-4 py-2 border border-black/16 rounded-lg focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
            <button
              onClick={() => runSearch(query)}
              disabled={isLoading || !query.trim()}
              className="btn-primary disabled:opacity-50"
            >
              Search
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="overflow-auto flex-1 p-4 min-h-[240px]">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-text-muted text-sm">Searching DSLD...</span>
            </div>
          )}

          {!isLoading && error && (
            <div className="flex items-center justify-center py-8">
              <p className="text-critical text-sm text-center max-w-xs">
                {error}
              </p>
            </div>
          )}

          {!isLoading && !error && hasSearched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-1">
              <p className="text-text-muted text-sm">
                No matches found in DSLD.
              </p>
              <p className="text-text-muted text-xs">
                Try a different term, or close this and enter details manually.
              </p>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="space-y-2">
              {results.map((hit) => {
                const isSelecting = selectingId === hit.dsldId;
                return (
                  <button
                    key={hit.dsldId}
                    onClick={() => handleSelect(hit)}
                    disabled={!!selectingId}
                    className="w-full flex items-center gap-3 text-left p-3 border border-black/10 rounded-lg hover:border-primary hover:bg-primary-light/30 transition-colors disabled:opacity-60"
                  >
                    <DsldThumb url={hit.thumbnailUrl} alt={hit.fullName} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">
                          {hit.fullName || "Unnamed product"}
                        </span>
                        {hit.offMarket && (
                          <span className="px-1.5 py-0.5 bg-black/5 text-text-muted text-[10px] rounded font-medium flex-shrink-0">
                            off market
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-muted truncate">
                        {[hit.brandName, hit.form, hit.netContents]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      <div className="text-[10px] text-text-muted/70 font-mono mt-0.5">
                        DSLD #{hit.dsldId}
                      </div>
                    </div>
                    {isSelecting && (
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-black/10 p-4 flex justify-between items-center flex-shrink-0">
          <span className="text-xs text-text-muted">
            {results.length > 0 && `${results.length} results`}
          </span>
          <button onClick={onClose} className="btn-outline">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Thumbnail with graceful fallback when DSLD has no image for a label.
function DsldThumb({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !url) {
    return (
      <div className="w-12 h-12 flex-shrink-0 rounded bg-surface-alt border border-black/10 flex items-center justify-center text-text-muted text-[10px]">
        no img
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-12 h-12 flex-shrink-0 rounded object-cover bg-surface-alt border border-black/10"
    />
  );
}
