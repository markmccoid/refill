"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { RetailerDialog } from "@/components/restock/RetailerDialog";
import {
  hasDuplicateUrl,
  normalizeCandidateUrl,
} from "@/lib/candidate-product-utils";

export type CandidateSubjectKind = "supplement" | "group";

type Draft = {
  retailerId: string;
  label: string;
  url: string;
  count: string;
};

const emptyDraft = (): Draft => ({
  retailerId: "",
  label: "",
  url: "",
  count: "",
});

function storeLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function subjectArgs(
  kind: CandidateSubjectKind,
  subjectId: Id<"supplements"> | Id<"groups">
) {
  return kind === "supplement"
    ? { supplementId: subjectId as Id<"supplements"> }
    : { groupId: subjectId as Id<"groups"> };
}

/**
 * Shared Manage options drawer (ADR-0009 / Variant C): durable candidate CRUD
 * for a solo supplement or group subject. Opened from the subject summary card
 * or a Restock item.
 */
export function CandidateDrawer({
  open,
  onClose,
  householdId,
  subjectKind,
  subjectId,
  subjectName,
  openedFrom = "subject",
}: {
  open: boolean;
  onClose: () => void;
  householdId: Id<"households">;
  subjectKind: CandidateSubjectKind;
  subjectId: Id<"supplements"> | Id<"groups">;
  subjectName: string;
  openedFrom?: "subject" | "restock";
}) {
  const args = subjectArgs(subjectKind, subjectId);
  const candidates = useQuery(
    api.candidateProducts.listBySubject,
    open ? args : "skip"
  );
  const retailers = useQuery(
    api.retailers.list,
    open ? { householdId } : "skip"
  );
  const importPreview = useQuery(
    api.candidateSeeding.previewImport,
    open ? args : "skip"
  );

  const create = useMutation(api.candidateProducts.create);
  const update = useMutation(api.candidateProducts.update);
  const remove = useMutation(api.candidateProducts.remove);
  const importForSubject = useMutation(api.candidateSeeding.importForSubject);

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"candidateProducts"> | null>(
    null
  );
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retailerDialogOpen, setRetailerDialogOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<Id<"candidateProducts"> | null>(
    null
  );

  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Reset ephemeral UI when the drawer opens; expand add form when empty.
  useEffect(() => {
    if (!open) return;
    setError("");
    setEditingId(null);
    setDraft(emptyDraft());
    setHighlightId(null);
  }, [open, subjectId]);

  useEffect(() => {
    if (!open || candidates === undefined) return;
    if (candidates.length === 0) setAddOpen(true);
  }, [open, candidates]);

  useEffect(() => {
    if (!highlightId) return;
    const el = rowRefs.current.get(highlightId);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const t = window.setTimeout(() => setHighlightId(null), 1600);
    return () => window.clearTimeout(t);
  }, [highlightId, candidates]);

  if (!open) return null;

  const retailerName = (id: Id<"retailers">) =>
    retailers?.find((r) => r._id === id)?.name ?? "Retailer";

  const parseCount = (raw: string): number | undefined => {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error("Count must be a positive number.");
    }
    return n;
  };

  const findDuplicate = (url: string, excludeId?: Id<"candidateProducts">) => {
    if (!candidates) return undefined;
    const normalized = normalizeCandidateUrl(url);
    return candidates.find(
      (c) =>
        normalizeCandidateUrl(c.url) === normalized && c._id !== excludeId
    );
  };

  const scrollToExisting = (id: Id<"candidateProducts">) => {
    setHighlightId(id);
    const existing = candidates?.find((c) => c._id === id);
    if (!existing || !retailers) return;
    setEditingId(id);
    setEditDraft({
      retailerId: existing.retailerId,
      label: existing.label,
      url: existing.url,
      count: existing.count?.toString() ?? "",
    });
    setAddOpen(false);
  };

  const submitAdd = async () => {
    if (busy) return;
    setError("");
    const label = draft.label.trim();
    const url = draft.url.trim();
    if (!label || !url) {
      setError("Label and URL are required.");
      return;
    }
    if (!draft.retailerId) {
      setError("Pick a retailer.");
      return;
    }
    const dup = findDuplicate(url);
    if (dup || (candidates && hasDuplicateUrl(candidates, url))) {
      setError("That URL is already an option — edit the existing row.");
      if (dup) scrollToExisting(dup._id);
      return;
    }
    setBusy(true);
    try {
      await create({
        ...args,
        retailerId: draft.retailerId as Id<"retailers">,
        label,
        url,
        count: parseCount(draft.count),
      });
      setDraft(emptyDraft());
      setAddOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not add option.";
      setError(message);
      if (message.includes("already exists")) {
        const existing = findDuplicate(url);
        if (existing) scrollToExisting(existing._id);
      }
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async (id: Id<"candidateProducts">) => {
    if (busy) return;
    setError("");
    const label = editDraft.label.trim();
    const url = editDraft.url.trim();
    if (!label || !url) {
      setError("Label and URL are required.");
      return;
    }
    if (!editDraft.retailerId) {
      setError("Pick a retailer.");
      return;
    }
    const dup = findDuplicate(url, id);
    if (dup) {
      setError("That URL is already an option — edit the existing row.");
      scrollToExisting(dup._id);
      return;
    }
    setBusy(true);
    try {
      const countRaw = editDraft.count.trim();
      await update({
        id,
        label,
        url,
        retailerId: editDraft.retailerId as Id<"retailers">,
        count: countRaw === "" ? null : parseCount(countRaw),
      });
      setEditingId(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save option.";
      setError(message);
      if (message.includes("already exists")) {
        const existing = findDuplicate(url, id);
        if (existing) scrollToExisting(existing._id);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (
    id: Id<"candidateProducts">,
    selectedOnActivePlan: boolean
  ) => {
    if (busy) return;
    const ok = window.confirm(
      selectedOnActivePlan
        ? "This option is selected on your Restock plan. Remove it and clear that selection?"
        : "Remove this restock option?"
    );
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      await remove({ id });
      if (editingId === id) setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove option.");
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await importForSubject(args);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not import saved links."
      );
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (id: Id<"candidateProducts">) => {
    const row = candidates?.find((c) => c._id === id);
    if (!row) return;
    setEditingId(id);
    setEditDraft({
      retailerId: row.retailerId,
      label: row.label,
      url: row.url,
      count: row.count?.toString() ?? "",
    });
    setAddOpen(false);
    setError("");
  };

  const loading = candidates === undefined || retailers === undefined;

  return (
    <>
      <button
        type="button"
        aria-label="Close drawer"
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-surface border-l border-border-strong shadow-2xl flex flex-col">
        <div className="border-b border-border px-5 py-4">
          <p className="text-[11px] uppercase tracking-wide text-text-muted">
            Opened from{" "}
            {openedFrom === "subject" ? "subject page" : "restock item"}
          </p>
          <h2 className="font-bold text-lg mt-0.5 break-words">
            {subjectName} — options
          </h2>
          <p className="text-xs text-text-muted mt-1 leading-snug">
            Durable candidates for this subject. Changes apply everywhere.
          </p>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-critical/25 bg-critical-light px-3 py-2 text-sm text-critical">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-text-muted">Loading options…</p>
          ) : candidates.length === 0 && !addOpen ? (
            <p className="text-sm text-text-muted">
              No restock options yet. Add a product link you might buy next
              cycle.
            </p>
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => {
                const isEditing = editingId === c._id;
                const highlighted = highlightId === c._id;
                return (
                  <div
                    key={c._id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(c._id, el);
                      else rowRefs.current.delete(c._id);
                    }}
                    className={`rounded-lg border px-3 py-2.5 ${
                      highlighted
                        ? "border-primary bg-primary-light/30"
                        : "border-border"
                    }`}
                  >
                    {isEditing ? (
                      <CandidateForm
                        draft={editDraft}
                        onChange={setEditDraft}
                        retailers={retailers}
                        onAddRetailer={() => setRetailerDialogOpen(true)}
                        submitLabel="Save"
                        onSubmit={() => submitEdit(c._id)}
                        onCancel={() => setEditingId(null)}
                        busy={busy}
                      />
                    ) : (
                      <div className="flex gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{c.label}</p>
                          <p className="text-[11px] text-text-muted">
                            {retailerName(c.retailerId)}
                            {c.count ? ` · ${c.count}-ct` : ""} ·{" "}
                            {storeLabel(c.url)}
                          </p>
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-primary hover:underline"
                          >
                            Open link ↗
                          </a>
                        </div>
                        <button
                          type="button"
                          className="text-xs text-primary shrink-0"
                          onClick={() => startEdit(c._id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(c._id, c.selectedOnActivePlan)
                          }
                          className="text-text-muted hover:text-critical shrink-0"
                          aria-label="Remove option"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && (
            <>
              {addOpen ? (
                <div className="rounded-lg border border-dashed border-border-strong p-3 space-y-2">
                  <p className="text-xs font-semibold">Quick add</p>
                  <CandidateForm
                    draft={draft}
                    onChange={setDraft}
                    retailers={retailers}
                    onAddRetailer={() => setRetailerDialogOpen(true)}
                    submitLabel="Add option"
                    onSubmit={submitAdd}
                    onCancel={
                      candidates.length > 0
                        ? () => {
                            setAddOpen(false);
                            setDraft(emptyDraft());
                          }
                        : undefined
                    }
                    busy={busy}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAddOpen(true);
                    setEditingId(null);
                  }}
                  className="text-sm font-semibold text-primary"
                >
                  + Add option
                </button>
              )}

              <div className="rounded-lg border border-border bg-surface-alt px-3 py-2.5 space-y-2">
                <p className="text-xs font-semibold">Import from saved links</p>
                <p className="text-[11px] text-text-muted">
                  {importPreview === undefined
                    ? "Checking saved links…"
                    : importPreview.newCount === 0
                      ? "No new URLs to import."
                      : `${importPreview.newCount} new URL${
                          importPreview.newCount === 1 ? "" : "s"
                        } ready to add.`}
                </p>
                <button
                  type="button"
                  disabled={
                    busy ||
                    importPreview === undefined ||
                    importPreview.newCount === 0
                  }
                  onClick={handleImport}
                  className="text-sm font-semibold text-primary disabled:opacity-40"
                >
                  Import new links
                </button>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-sm font-semibold bg-primary text-white rounded-lg"
          >
            Done
          </button>
        </div>
      </aside>

      {retailerDialogOpen && (
        <RetailerDialog
          householdId={householdId}
          retailer={null}
          onClose={() => setRetailerDialogOpen(false)}
        />
      )}
    </>
  );
}

function CandidateForm({
  draft,
  onChange,
  retailers,
  onAddRetailer,
  submitLabel,
  onSubmit,
  onCancel,
  busy,
}: {
  draft: Draft;
  onChange: (next: Draft) => void;
  retailers: Array<{ _id: Id<"retailers">; name: string }>;
  onAddRetailer: () => void;
  submitLabel: string;
  onSubmit: () => void;
  onCancel?: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-2">
      <input
        placeholder="Label"
        value={draft.label}
        onChange={(e) => onChange({ ...draft, label: e.target.value })}
        className="w-full px-2 py-1.5 text-sm border border-border-strong rounded-md bg-surface"
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <select
            value={draft.retailerId}
            onChange={(e) =>
              onChange({ ...draft, retailerId: e.target.value })
            }
            className="w-full px-2 py-1.5 text-sm border border-border-strong rounded-md bg-surface"
          >
            <option value="">Retailer…</option>
            {retailers.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onAddRetailer}
            className="text-[11px] text-primary hover:underline"
          >
            + Add retailer
          </button>
        </div>
        <input
          placeholder="Count"
          value={draft.count}
          onChange={(e) => onChange({ ...draft, count: e.target.value })}
          inputMode="numeric"
          className="px-2 py-1.5 text-sm border border-border-strong rounded-md bg-surface self-start"
        />
      </div>
      <input
        placeholder="URL"
        value={draft.url}
        onChange={(e) => onChange({ ...draft, url: e.target.value })}
        className="w-full px-2 py-1.5 text-sm border border-border-strong rounded-md bg-surface"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy}
          className="text-sm font-semibold text-primary disabled:opacity-50"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-text-muted hover:text-text"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
