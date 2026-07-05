"use client";

// Presentational supplement-facts renderer. Takes plain data so it can show
// saved facts (SupplementFactsPanel), a pre-save DSLD preview, or a staged
// manual draft — anything shaped like a facts record.

export interface FactsRowData {
  name: string;
  ingredientGroup?: string;
  category?: string;
  amount?: number;
  unit?: string;
  operator?: string;
  dvPercent?: number;
  dvFootnote?: string;
  level: number;
  isOther: boolean;
}

export interface FactsViewData {
  servingSize?: string;
  servingsPerContainer?: number;
  rows: FactsRowData[];
  otherIngredients?: string;
  offMarket?: boolean;
  thumbnailUrl?: string | null;
  pdfUrl?: string | null;
  dsldId?: string;
  upcSku?: string;
  source?: "dsld" | "manual";
  edited?: boolean;
}

/** Provenance line, e.g. "Source: DSLD #12345 · edited" or "Entered manually". */
export function factsSourceLabel(facts: FactsViewData): string {
  if (facts.source === "manual" || (!facts.dsldId && facts.source !== "dsld")) {
    return "Entered manually";
  }
  return `Source: DSLD #${facts.dsldId}${facts.edited ? " · edited" : ""}${
    facts.upcSku ? ` · UPC ${facts.upcSku}` : ""
  }`;
}

export function FactsView({ facts }: { facts: FactsViewData }) {
  return (
    <div className="space-y-4">
      {(facts.servingSize || facts.servingsPerContainer != null) && (
        <div className="text-sm border-b-2 border-text/80 pb-2">
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
          <div className="flex justify-between text-[11px] font-semibold text-text-muted border-b border-text/30 pb-1">
            <span>Amount Per Serving</span>
            <span>% DV</span>
          </div>
          <div className="divide-y divide-border">
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
        <div className="text-xs text-text-muted border-t border-border-strong pt-3">
          <span className="font-semibold text-text-label">
            Other ingredients:{" "}
          </span>
          {facts.otherIngredients}
        </div>
      )}

      {/* Label image / back panel */}
      {(facts.thumbnailUrl || facts.pdfUrl) && (
        <div className="border-t border-border-strong pt-4 flex items-center gap-4">
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
                className="h-20 rounded border border-border-strong object-contain bg-surface-alt hover:border-primary transition-colors"
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
          </div>
        </div>
      )}
    </div>
  );
}
