"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { FactsView, factsSourceLabel } from "@/components/FactsView";
import { FactsEditorModal } from "@/components/FactsEditorModal";
import { DsldFindDetails, type DsldLabel } from "@/components/DsldFindDetails";

export function SupplementFactsPanel({
  supplementId,
  supplementName,
}: {
  supplementId: Id<"supplements">;
  /** Seeds the DSLD search in the empty state. */
  supplementName: string;
}) {
  const facts = useQuery(api.supplementFacts.getBySupplementId, {
    supplementId,
  });
  const saveFacts = useMutation(api.supplementFacts.save);
  const removeFacts = useMutation(api.supplementFacts.remove);
  const importFacts = useAction(api.dsld.importFacts);

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (facts === undefined) return null; // loading

  // Facts affect only this panel here — picking a DSLD product imports
  // immediately (identity fields are managed by the Edit flow above).
  const handleImport = async (dsldId: string) => {
    setBusy(true);
    setError("");
    try {
      await importFacts({ supplementId, dsldId });
    } catch (err) {
      console.error("Failed to import DSLD facts:", err);
      setError("Failed to import facts from DSLD. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleRevert = async () => {
    if (!facts?.dsldId) return;
    if (
      !confirm(
        `Discard your edits and re-import the original facts from DSLD #${facts.dsldId}?`
      )
    ) {
      return;
    }
    await handleImport(facts.dsldId);
  };

  const handleRemove = async () => {
    if (
      !confirm(
        "Remove the supplement facts (and saved label files) from this supplement?"
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await removeFacts({ supplementId });
    } catch (err) {
      console.error("Failed to remove facts:", err);
      setError("Failed to remove facts. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Supplement Facts</h2>
        {facts?.offMarket && (
          <span className="px-2 py-0.5 bg-text/5 text-text-muted text-xs rounded font-medium">
            off market
          </span>
        )}
      </div>

      {error && <p className="text-critical text-sm">{error}</p>}

      {facts === null ? (
        // Empty state: no facts yet — offer both ways in.
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            No supplement facts saved yet. Pull them from the NIH label
            database, or copy them off the bottle yourself.
          </p>
          <div className="flex gap-2">
            <DsldFindDetails
              initialQuery={supplementName}
              onApply={(label: DsldLabel) => handleImport(label.dsldId)}
              buttonLabel={busy ? "Importing..." : "Find in DSLD"}
              onManualEntry={() => setEditing(true)}
            />
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={busy}
              className="btn-outline disabled:opacity-50"
            >
              Enter manually
            </button>
          </div>
        </div>
      ) : (
        <>
          <FactsView facts={facts} />

          {/* Provenance + actions */}
          <div className="border-t border-border-strong pt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-text-muted">{factsSourceLabel(facts)}</span>
            <div className="ml-auto flex gap-3">
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={busy}
                className="text-primary hover:underline disabled:opacity-50"
              >
                Edit facts
              </button>
              {facts.edited && facts.dsldId && (
                <button
                  type="button"
                  onClick={handleRevert}
                  disabled={busy}
                  className="text-primary hover:underline disabled:opacity-50"
                >
                  {busy ? "Reverting..." : "Revert to DSLD"}
                </button>
              )}
              <button
                type="button"
                onClick={handleRemove}
                disabled={busy}
                className="text-critical hover:underline disabled:opacity-50"
              >
                Remove facts
              </button>
            </div>
          </div>
        </>
      )}

      {editing && (
        <FactsEditorModal
          initial={facts}
          onSave={async (payload) => {
            await saveFacts({ supplementId, ...payload });
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
