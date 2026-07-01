"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export function SupplementFactsPanel({
  supplementId,
}: {
  supplementId: Id<"supplements">;
}) {
  const facts = useQuery(api.supplementFacts.getBySupplementId, {
    supplementId,
  });

  // Loading or no DSLD data linked — render nothing.
  if (facts === undefined || facts === null) return null;

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Supplement Facts</h2>
        {facts.offMarket && (
          <span className="px-2 py-0.5 bg-black/5 text-text-muted text-xs rounded font-medium">
            off market
          </span>
        )}
      </div>

      {(facts.servingSize || facts.servingsPerContainer != null) && (
        <div className="text-sm border-b-2 border-black/80 pb-2">
          {facts.servingSize && (
            <div className="font-semibold">
              Serving Size {facts.servingSize}
            </div>
          )}
          {facts.servingsPerContainer != null && (
            <div className="text-text-muted">
              Servings Per Container {facts.servingsPerContainer}
            </div>
          )}
        </div>
      )}

      {/* Facts rows */}
      {facts.rows.length > 0 && (
        <div className="text-sm">
          <div className="flex justify-between text-[11px] font-semibold text-text-muted border-b border-black/30 pb-1">
            <span>Amount Per Serving</span>
            <span>% DV</span>
          </div>
          <div className="divide-y divide-black/5">
            {facts.rows.map((row, i) => (
              <div
                key={i}
                className="flex justify-between items-baseline py-1.5"
                style={{ paddingLeft: `${row.level * 16}px` }}
              >
                <span
                  className={row.level === 0 ? "font-medium" : "text-text-muted"}
                >
                  {row.name}
                  {row.amount != null && (
                    <span className="ml-2 font-mono text-text">
                      {row.operator ? `${row.operator} ` : ""}
                      {row.amount}
                      {row.unit ? ` ${row.unit}` : ""}
                    </span>
                  )}
                </span>
                <span className="font-mono text-text-muted ml-3 flex-shrink-0">
                  {row.dvPercent != null
                    ? `${row.dvPercent}%`
                    : row.dvFootnote
                      ? "†"
                      : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {facts.otherIngredients && (
        <div className="text-xs text-text-muted border-t border-black/10 pt-3">
          <span className="font-semibold text-text-label">
            Other ingredients:{" "}
          </span>
          {facts.otherIngredients}
        </div>
      )}

      {/* Label image / back panel */}
      {(facts.thumbnailUrl || facts.pdfUrl) && (
        <div className="border-t border-black/10 pt-4 flex items-center gap-4">
          {facts.thumbnailUrl && (
            <a
              href={facts.pdfUrl || facts.thumbnailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block flex-shrink-0"
            >
              <img
                src={facts.thumbnailUrl}
                alt="Label thumbnail"
                className="h-20 rounded border border-black/10 object-contain bg-surface-alt hover:border-primary transition-colors"
              />
            </a>
          )}
          <div className="text-sm">
            {facts.pdfUrl ? (
              <a
                href={facts.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                View full label (PDF) →
              </a>
            ) : (
              <span className="text-text-muted">Label image saved</span>
            )}
            <p className="text-xs text-text-muted mt-1">
              Source: DSLD #{facts.dsldId}
              {facts.upcSku ? ` · UPC ${facts.upcSku}` : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
