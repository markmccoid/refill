"use client";

import { useState } from "react";
import {
  initialCandidates,
  mockSubject,
  storeLabel,
  type MockCandidate,
} from "./mock-data";

export const variantName = "Inline on Restock";

/** All candidate CRUD on the Restock item card; subject page has no library UI. */
export function VariantB() {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [selectedId, setSelectedId] = useState<string | null>("c1");
  const [expanded, setExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    retailer: "",
    label: "",
    url: "",
    count: "",
  });

  const addCandidate = () => {
    if (!draft.label.trim() || !draft.url.trim()) return;
    const id = `c${Date.now()}`;
    setCandidates((prev) => [
      ...prev,
      {
        id,
        retailer: draft.retailer || "Other",
        label: draft.label.trim(),
        url: draft.url.trim(),
        count: draft.count ? parseInt(draft.count, 10) : null,
        lastPrice: null,
      },
    ]);
    setSelectedId(id);
    setDraft({ retailer: "", label: "", url: "", count: "" });
    setAdding(false);
  };

  const removeCandidate = (id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(candidates.find((c) => c.id !== id)?.id ?? null);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
          Variant B — Inline on Restock
        </p>
        <h1 className="text-2xl font-bold">Candidate capture prototype</h1>
        <p className="text-sm text-text-muted">
          The Restock item card owns the full candidate list — add, edit, remove,
          and select in one place. Subject pages stay inventory-focused.
        </p>
      </header>

      <article className="bg-surface border border-border-strong rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold">{mockSubject.name}</h2>
              <span className="text-[10px] font-bold uppercase tracking-wide bg-primary-light text-primary px-1.5 py-0.5 rounded">
                Group
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {mockSubject.onHand} available · runs out in {mockSubject.daysLeft}d
            </p>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-text-muted">
            Bottles
            <input
              type="number"
              defaultValue={2}
              className="w-14 px-2 py-1 text-sm border border-border-strong rounded-md text-center"
            />
          </label>
        </div>

        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-bold"
          >
            <span>Compare options ({candidates.length})</span>
            <span className="text-text-muted">{expanded ? "▾" : "▸"}</span>
          </button>

          {expanded && (
            <div className="mt-3 space-y-2">
              {candidates.map((c) => (
                <CandidateRow
                  key={c.id}
                  candidate={c}
                  selected={selectedId === c.id}
                  onSelect={() => setSelectedId(c.id)}
                  onRemove={() => removeCandidate(c.id)}
                />
              ))}

              {adding ? (
                <div className="rounded-lg border border-dashed border-border-strong p-3 space-y-2">
                  <input
                    placeholder="Product label"
                    value={draft.label}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-border-strong rounded-md"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      placeholder="Retailer"
                      value={draft.retailer}
                      onChange={(e) => setDraft({ ...draft, retailer: e.target.value })}
                      className="px-2 py-1.5 text-sm border border-border-strong rounded-md"
                    />
                    <input
                      placeholder="Count"
                      value={draft.count}
                      onChange={(e) => setDraft({ ...draft, count: e.target.value })}
                      className="px-2 py-1.5 text-sm border border-border-strong rounded-md"
                    />
                  </div>
                  <input
                    placeholder="URL"
                    value={draft.url}
                    onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-border-strong rounded-md"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={addCandidate}
                      className="text-sm font-semibold text-primary"
                    >
                      Add & select
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdding(false)}
                      className="text-sm text-text-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="w-full rounded-lg border border-dashed border-border-strong py-2 text-sm text-primary font-semibold hover:bg-text/5"
                >
                  + Add another option
                </button>
              )}
            </div>
          )}
        </div>
      </article>

      <p className="text-xs text-text-muted border border-dashed border-border rounded-lg p-3">
        Supplement detail page: no candidate section — only bottle history and
        &quot;Buy again&quot; chips from past purchases. Options accumulate as you
        restock.
      </p>

      <pre className="text-[11px] bg-surface-alt border border-border rounded-lg p-3 overflow-auto">
        {JSON.stringify({ candidateCount: candidates.length, selectedId, candidates }, null, 2)}
      </pre>
    </div>
  );
}

function CandidateRow({
  candidate,
  selected,
  onSelect,
  onRemove,
}: {
  candidate: MockCandidate;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 rounded-lg border px-2 py-2 text-sm ${
        selected ? "border-primary bg-primary-light/25" : "border-border"
      }`}
    >
      <input type="radio" checked={selected} onChange={onSelect} />
      <div className="min-w-0">
        <p className="font-medium truncate">{candidate.label}</p>
        <p className="text-[11px] text-text-muted truncate">
          {candidate.retailer} · {storeLabel(candidate.url)}
        </p>
      </div>
      <input
        type="text"
        placeholder="Price"
        className="w-16 px-1.5 py-1 text-xs border border-border-strong rounded text-right"
      />
      <a href={candidate.url} className="text-xs text-primary whitespace-nowrap">
        Check ↗
      </a>
      <button
        type="button"
        onClick={onRemove}
        className="text-text-muted hover:text-red-600"
      >
        ×
      </button>
    </div>
  );
}
