"use client";

import { useState, useEffect, useCallback } from "react";

interface ImageResult {
  url: string;
  thumbUrl: string;
  title: string;
}

interface ImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (url: string) => void;
  initialQuery?: string;
}

export function ImageSearchModal({
  isOpen,
  onClose,
  onSelectImage,
  initialQuery = "",
}: ImageSearchModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<ImageResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setError(null);
    setResults([]);
    setHasSearched(true);
    try {
      const response = await fetch("/api/image-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Search failed");
      }
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Search failed. Check your connection."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Seed the search with the product title each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setResults([]);
      setError(null);
      setHasSearched(false);
      if (initialQuery.trim()) {
        search(initialQuery);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSelect = async (result: ImageResult) => {
    setDownloadingUrl(result.url);
    setError(null);
    try {
      const response = await fetch("/api/fetch-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: result.url }),
      });
      const data = await response.json();
      if (response.ok && data.dataUrl) {
        onSelectImage(data.dataUrl);
      } else {
        throw new Error(data.error || "Failed to download image");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to download image"
      );
    } finally {
      setDownloadingUrl(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 bg-surface rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-card">
        {/* Header */}
        <div className="border-b border-black/10 p-6 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold">Search product images</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Results from the Open Food Facts catalog
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
              placeholder="Search for a supplement..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search(query)}
              className="flex-1 px-4 py-2 border border-black/16 rounded-lg focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
            <button
              onClick={() => search(query)}
              disabled={isLoading || !query.trim()}
              className="btn-primary disabled:opacity-50"
            >
              Search
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="overflow-auto flex-1 p-6 min-h-[220px]">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-text-muted text-sm">Searching...</span>
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
            <div className="flex items-center justify-center py-8">
              <p className="text-text-muted text-sm">
                No results found. Try a different search term.
              </p>
            </div>
          )}

          {!isLoading && !hasSearched && (
            <div className="flex items-center justify-center py-8">
              <p className="text-text-muted text-sm">
                Enter a product name above to search.
              </p>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="grid grid-cols-4 gap-4">
              {results.map((result, idx) => {
                const isThisDownloading = downloadingUrl === result.url;
                return (
                  <button
                    key={`${result.url}-${idx}`}
                    onClick={() => handleSelect(result)}
                    disabled={!!downloadingUrl}
                    className="group relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-all hover:shadow-lg disabled:opacity-60"
                    title={result.title}
                  >
                    <img
                      src={result.thumbUrl}
                      alt={result.title}
                      loading="lazy"
                      className="w-full h-full object-cover bg-surface-alt group-hover:scale-105 transition-transform"
                    />
                    {isThisDownloading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-black/10 p-6 flex justify-end flex-shrink-0">
          <button onClick={onClose} className="btn-outline">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
