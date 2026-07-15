"use client";

import { useState } from "react";
import {
  initialCandidates,
  mockSubject,
  perPill,
  storeLabel,
  type MockCandidate,
} from "./mock-data";

export const variantName = "Shared drawer";

type DrawerContext = { from: "subject" | "restock"; subjectName: string };

/** One slide-over CRUD surface opened from Restock or subject page — same UI both places. */
export function VariantC() {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [selectedId, setSelectedId] = useState<string | null>("c1");
  const [drawer, setDrawer] = useState<DrawerContext | null>(null);
  const [draft, setDraft] = useState({
    retailer: "",
    label: "",
    url: "",
    count: "",
  });

  const openDrawer = (from: DrawerContext["from"]) => {
    setDrawer({ from, subjectName: mockSubject.name });
  };

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
  };

  const removeCandidate = (id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="space-y-6 max-w-4xl relative">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
          Variant C — Shared drawer
        </p>
        <h1 className="text-2xl font-bold">Candidate capture prototype</h1>
        <p className="text-sm text-text-muted">
          One drawer component for add/edit/remove — opened from the subject page
          or a Restock item header. Context banner shows where you came from.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <MiniSubjectPage onManage={() => openDrawer("subject")} count={candidates.length} />
        <MiniRestockItem
          candidates={candidates}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onManage={() => openDrawer("restock")}
        />
      </div>

      {drawer && (
        <>
          <button
            type="button"
            aria-label="Close drawer"
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setDrawer(null)}
          />
          <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-surface border-l border-border-strong shadow-2xl flex flex-col">
            <div className="border-b border-border px-5 py-4">
              <p className="text-[11px] uppercase tracking-wide text-text-muted">
                Opened from {drawer.from === "subject" ? "subject page" : "restock item"}
              </p>
              <h2 className="font-bold text-lg mt-0.5">{drawer.subjectName} — options</h2>
              <p className="text-xs text-text-muted mt-1">
                Durable candidates for this subject. Changes apply everywhere.
              </p>
            </div>

            <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
              <div className="space-y-2">
                {candidates.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border border-border px-3 py-2.5 flex gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{c.label}</p>
                      <p className="text-[11px] text-text-muted">
                        {c.retailer}
                        {c.count ? ` · ${c.count}-ct` : ""} · {storeLabel(c.url)}
                        {c.lastPrice && c.count
                          ? ` · ${perPill(c.lastPrice, c.count)}/pill hist.`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-primary shrink-0"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCandidate(c.id)}
                      className="text-text-muted hover:text-red-600 shrink-0"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-dashed border-border-strong p-3 space-y-2">
                <p className="text-xs font-semibold">Quick add</p>
                <input
                  placeholder="Label"
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
                <button
                  type="button"
                  onClick={addCandidate}
                  className="text-sm font-semibold text-primary"
                >
                  Add option
                </button>
              </div>
            </div>

            <div className="border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={() => setDrawer(null)}
                className="w-full py-2 text-sm font-semibold bg-primary text-white rounded-lg"
              >
                Done
              </button>
            </div>
          </aside>
        </>
      )}

      <pre className="text-[11px] bg-surface-alt border border-border rounded-lg p-3 overflow-auto">
        {JSON.stringify(
          { drawerOpen: !!drawer, drawerFrom: drawer?.from, candidateCount: candidates.length, selectedId },
          null,
          2
        )}
      </pre>
    </div>
  );
}

function MiniSubjectPage({
  onManage,
  count,
}: {
  onManage: () => void;
  count: number;
}) {
  return (
    <section className="bg-surface border border-border-strong rounded-xl p-4 space-y-3">
      <p className="text-[10px] font-bold uppercase text-text-muted">Subject page excerpt</p>
      <h3 className="font-bold">{mockSubject.name}</h3>
      <div className="rounded-lg bg-surface-alt border border-border p-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Restock options</p>
          <p className="text-xs text-text-muted">{count} saved links</p>
        </div>
        <button
          type="button"
          onClick={onManage}
          className="px-3 py-1.5 text-sm font-semibold border border-border-strong rounded-lg hover:bg-text/5"
        >
          Manage →
        </button>
      </div>
    </section>
  );
}

function MiniRestockItem({
  candidates,
  selectedId,
  onSelect,
  onManage,
}: {
  candidates: MockCandidate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onManage: () => void;
}) {
  const selected = candidates.find((c) => c.id === selectedId);
  return (
    <section className="bg-surface border border-border-strong rounded-xl p-4 space-y-3">
      <p className="text-[10px] font-bold uppercase text-text-muted">Restock item excerpt</p>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">{mockSubject.name}</h3>
        <button
          type="button"
          onClick={onManage}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Manage options
        </button>
      </div>
      {selected ? (
        <div className="rounded-lg border border-primary bg-primary-light/20 px-3 py-2">
          <p className="text-sm font-medium">{selected.label}</p>
          <p className="text-xs text-text-muted">{selected.retailer} · enter price…</p>
        </div>
      ) : (
        <p className="text-xs text-text-muted">No candidate selected</p>
      )}
      <div className="flex flex-wrap gap-1">
        {candidates.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className={`text-[11px] px-2 py-0.5 rounded-full border ${
              selectedId === c.id
                ? "border-primary bg-primary-light/40 font-semibold"
                : "border-border text-text-muted"
            }`}
          >
            {c.retailer}
          </button>
        ))}
      </div>
    </section>
  );
}
