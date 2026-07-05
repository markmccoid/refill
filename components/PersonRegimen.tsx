"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { DosageInput } from "@/components/DosageInput";
import { getDosageWeekly } from "@/lib/supplement-utils";

const perDay = (weekly: number) => Math.round((weekly / 7) * 100) / 100;

/**
 * A person's regimen: the supplements they take (with editable dosage) plus a
 * "Not taken" group to add a dosage. Dosage add/edit/remove all reanchor via
 * the dosages.* mutations. Disabled people render read-only (see ADR-0003).
 */
export function PersonRegimen({
  personId,
  householdId,
  readOnly = false,
}: {
  personId: Id<"people">;
  householdId: Id<"households">;
  readOnly?: boolean;
}) {
  const supplements = useQuery(api.supplements.list, { householdId });
  const dosages = useQuery(api.dosages.listByPersonId, { personId });

  const createDosage = useMutation(api.dosages.create);
  const updateDosage = useMutation(api.dosages.update);
  const removeDosage = useMutation(api.dosages.remove);

  // Which supplement's editor is open, and its working pills-per-week value.
  const [editingSupplementId, setEditingSupplementId] =
    useState<Id<"supplements"> | null>(null);
  const [draft, setDraft] = useState(7);
  const [busy, setBusy] = useState(false);

  if (!supplements || !dosages) {
    return <div className="px-4 py-4 text-sm text-text-muted">Loading…</div>;
  }

  // Join: a supplement is "taking" if this person has a dosage for it.
  const dosageBySupplement = new Map(dosages.map((d) => [d.supplementId, d]));
  const taking = supplements.filter((s) => dosageBySupplement.has(s._id));
  const notTaken = supplements.filter((s) => !dosageBySupplement.has(s._id));

  const openEditor = (supplementId: Id<"supplements">, weekly: number) => {
    setEditingSupplementId(supplementId);
    setDraft(weekly);
  };

  // Save an existing dosage; 0 (or less) means "stop taking" -> remove.
  const saveEdit = async (dosageId: Id<"dosages">) => {
    setBusy(true);
    try {
      if (draft <= 0) {
        await removeDosage({ id: dosageId });
      } else {
        await updateDosage({ id: dosageId, pillsPerWeek: draft });
      }
      setEditingSupplementId(null);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (dosageId: Id<"dosages">) => {
    setBusy(true);
    try {
      await removeDosage({ id: dosageId });
      setEditingSupplementId(null);
    } finally {
      setBusy(false);
    }
  };

  // Add a dosage from the Not-taken group; ignore a 0 amount.
  const add = async (supplementId: Id<"supplements">) => {
    if (draft <= 0) {
      setEditingSupplementId(null);
      return;
    }
    setBusy(true);
    try {
      await createDosage({ supplementId, personId, pillsPerWeek: draft });
      setEditingSupplementId(null);
    } finally {
      setBusy(false);
    }
  };

  const nameLink = (s: { _id: Id<"supplements">; name: string }) => (
    <Link
      href={`/supplements/${s._id}`}
      className="font-medium hover:text-primary hover:underline"
    >
      {s.name} <span className="text-text-muted">↗</span>
    </Link>
  );

  return (
    <div className="px-4 pb-4 pt-1 space-y-5">
      {/* Taking */}
      <div>
        <h3 className="text-xs font-semibold text-text-label uppercase tracking-wide mb-2">
          Taking ({taking.length})
          {readOnly && taking.length > 0 && (
            <span className="ml-2 font-normal normal-case text-text-muted">
              — paused, re-enable to edit
            </span>
          )}
        </h3>
        {taking.length === 0 ? (
          <p className="text-sm text-text-muted">Not taking anything yet.</p>
        ) : (
          <div className="space-y-1.5">
            {taking.map((s) => {
              const dosage = dosageBySupplement.get(s._id)!;
              const weekly = getDosageWeekly(dosage);
              const isEditing = editingSupplementId === s._id;
              return (
                <div
                  key={s._id}
                  className="border border-border-strong rounded-lg p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>{nameLink(s)}</div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm">
                        {weekly}/wk · {perDay(weekly)}/day
                      </span>
                      {!readOnly && !isEditing && (
                        <>
                          <button
                            onClick={() => openEditor(s._id, weekly)}
                            className="text-sm text-primary hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => remove(dosage._id)}
                            disabled={busy}
                            className="text-sm text-critical hover:text-critical/80 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {isEditing && (
                    <div className="mt-3 space-y-3 border-t border-border-strong pt-3">
                      <DosageInput value={draft} onChange={setDraft} />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(dosage._id)}
                          disabled={busy}
                          className="btn-primary text-sm py-1.5 px-4 disabled:opacity-50"
                        >
                          {busy ? "Saving…" : draft <= 0 ? "Remove" : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingSupplementId(null)}
                          className="btn-outline text-sm py-1.5 px-4"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Not taken */}
      {!readOnly && (
        <div>
          <h3 className="text-xs font-semibold text-text-label uppercase tracking-wide mb-2">
            Not taken ({notTaken.length})
          </h3>
          {notTaken.length === 0 ? (
            <p className="text-sm text-text-muted">
              Taking every supplement in the household.
            </p>
          ) : (
            <div className="space-y-1.5">
              {notTaken.map((s) => {
                const isAdding = editingSupplementId === s._id;
                return (
                  <div
                    key={s._id}
                    className="border border-dashed border-border-strong rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-text-muted">{nameLink(s)}</div>
                      {!isAdding && (
                        <button
                          onClick={() => openEditor(s._id, 7)}
                          className="text-sm text-primary hover:underline"
                        >
                          + add
                        </button>
                      )}
                    </div>
                    {isAdding && (
                      <div className="mt-3 space-y-3 border-t border-border-strong pt-3">
                        <DosageInput value={draft} onChange={setDraft} />
                        <div className="flex gap-2">
                          <button
                            onClick={() => add(s._id)}
                            disabled={busy || draft <= 0}
                            className="btn-primary text-sm py-1.5 px-4 disabled:opacity-50"
                          >
                            {busy ? "Adding…" : "Add dosage"}
                          </button>
                          <button
                            onClick={() => setEditingSupplementId(null)}
                            className="btn-outline text-sm py-1.5 px-4"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
