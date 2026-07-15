"use client";

import { useState } from "react";
import {
  initialCandidates,
  mockSubject,
  perPill,
  storeLabel,
  type MockCandidate,
} from "./mock-data";

export const variantName = "Subject-page library";

/** Candidates curated on the supplement/group page; Restock only picks from the library. */
export function VariantA() {
  const [view, setView] = useState<"subject" | "restock">("subject");
  const [candidates, setCandidates] = useState(initialCandidates);
  const [selectedId, setSelectedId] = useState<string | null>("c1");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    retailer: "",
    label: "",
    url: "",
    count: "",
  });

  const addCandidate = () => {
    if (!draft.label.trim() || !draft.url.trim()) return;
    setCandidates((prev) => [
      ...prev,
      {
        id: `c${Date.now()}`,
        retailer: draft.retailer || "Other",
        label: draft.label.trim(),
        url: draft.url.trim(),
        count: draft.count ? parseInt(draft.count, 10) : null,
        lastPrice: null,
      },
    ]);
    setDraft({ retailer: "", label: "", url: "", count: "" });
    setShowForm(false);
  };

  const removeCandidate = (id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
          Variant A — Subject-page library
        </p>
        <h1 className="text-2xl font-bold">Candidate capture prototype</h1>
        <p className="text-sm text-text-muted">
          Manage the durable option list on the subject page. Restock is
          selection-only — no matrix, no inline add during comparison.
        </p>
        <div className="flex gap-2 pt-1">
          <ViewTab active={view === "subject"} onClick={() => setView("subject")}>
            Subject page
          </ViewTab>
          <ViewTab active={view === "restock"} onClick={() => setView("restock")}>
            Restock item (read-only list)
          </ViewTab>
        </div>
      </header>

      {view === "subject" ? (
        <section className="bg-surface border border-border-strong rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-lg">{mockSubject.name}</h2>
              <p className="text-xs text-text-muted mt-0.5">
                Group · {mockSubject.onHand} on hand · {mockSubject.daysLeft}d left
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="px-3 py-1.5 text-sm font-semibold bg-primary text-white rounded-lg"
            >
              + Add option
            </button>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-bold mb-1">Restock options</h3>
            <p className="text-xs text-text-muted mb-3">
              Saved product links for this subject — reused every restock cycle.
              Substitutes and brands you have never stocked are fine here.
            </p>

            {showForm && (
              <div className="mb-4 rounded-lg border border-dashed border-primary/40 bg-primary-light/20 p-4 space-y-3">
                <p className="text-xs font-semibold text-primary">New candidate</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    placeholder="Retailer (e.g. Amazon)"
                    value={draft.retailer}
                    onChange={(e) => setDraft({ ...draft, retailer: e.target.value })}
                    className="px-3 py-2 text-sm border border-border-strong rounded-md bg-surface"
                  />
                  <input
                    placeholder="Bottle count (optional)"
                    value={draft.count}
                    onChange={(e) => setDraft({ ...draft, count: e.target.value })}
                    className="px-3 py-2 text-sm border border-border-strong rounded-md bg-surface"
                  />
                </div>
                <input
                  placeholder="Product label (required)"
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-border-strong rounded-md bg-surface"
                />
                <input
                  placeholder="Product URL (required)"
                  value={draft.url}
                  onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-border-strong rounded-md bg-surface"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addCandidate}
                    className="px-3 py-1.5 text-sm font-semibold bg-primary text-white rounded-md"
                  >
                    Save option
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-3 py-1.5 text-sm border border-border-strong rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <ul className="space-y-2">
              {candidates.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{c.label}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {c.retailer} · {c.count ? `${c.count}-ct` : "count unset"} ·{" "}
                      <a href={c.url} className="text-primary hover:underline">
                        {storeLabel(c.url)} ↗
                      </a>
                      {c.lastPrice !== null && c.count
                        ? ` · last ${perPill(c.lastPrice, c.count)}/pill`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCandidate(c.id)}
                    className="text-text-muted hover:text-red-600 text-lg leading-none"
                    title="Remove"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <section className="bg-surface border border-border-strong rounded-xl p-5 space-y-4">
          <div>
            <h2 className="font-bold">{mockSubject.name}</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Restock plan item · pick one candidate · enter price this cycle
            </p>
          </div>

          <div className="rounded-lg bg-surface-alt border border-border px-3 py-2 text-xs text-text-muted flex items-center justify-between">
            <span>
              {candidates.length} saved option{candidates.length === 1 ? "" : "s"} on
              subject
            </span>
            <button
              type="button"
              onClick={() => setView("subject")}
              className="text-primary font-semibold hover:underline"
            >
              Manage on subject page →
            </button>
          </div>

          <fieldset className="space-y-2">
            {candidates.map((c) => (
              <label
                key={c.id}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer ${
                  selectedId === c.id
                    ? "border-primary bg-primary-light/30"
                    : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="candidate"
                  checked={selectedId === c.id}
                  onChange={() => setSelectedId(c.id)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{c.label}</p>
                  <p className="text-xs text-text-muted">
                    {c.retailer} · Check Site ↗ · price this cycle…
                  </p>
                </div>
              </label>
            ))}
          </fieldset>
          <p className="text-[11px] text-text-muted italic">
            No add/edit here — library lives on the subject page.
          </p>
        </section>
      )}

      <StateDump candidates={candidates} selectedId={selectedId} view={view} />
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-lg border ${
        active
          ? "border-primary bg-primary-light/40 font-semibold"
          : "border-border-strong text-text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function StateDump({
  candidates,
  selectedId,
  view,
}: {
  candidates: MockCandidate[];
  selectedId: string | null;
  view: string;
}) {
  return (
    <pre className="text-[11px] bg-surface-alt border border-border rounded-lg p-3 overflow-auto">
      {JSON.stringify({ view, candidateCount: candidates.length, selectedId, candidates }, null, 2)}
    </pre>
  );
}
