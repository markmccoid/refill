"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { DosageInput } from "@/components/DosageInput";
import { getDosageWeekly, isDosagePaused } from "@/lib/supplement-utils";

const perDay = (weekly: number) => Math.round((weekly / 7) * 100) / 100;

function toDateInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function fromDateInput(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0).getTime();
}

function pauseLabel(pauseUntil?: number) {
  if (!pauseUntil) return "Paused until resumed";
  return `Paused until ${new Date(pauseUntil).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

type PauseMode = "indefinite" | "date";

/**
 * A person's regimen: active supplements, paused dosages, and supplements not
 * taken yet. Disabled people render read-only (see ADR-0003).
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
  const supplements = useQuery(api.supplements.listBasic, { householdId });
  const dosages = useQuery(api.dosages.listByPersonId, { personId });

  const createDosage = useMutation(api.dosages.create);
  const updateDosage = useMutation(api.dosages.update);
  const removeDosage = useMutation(api.dosages.remove);
  const pauseDosage = useMutation(api.dosages.pause);
  const resumeDosage = useMutation(api.dosages.resume);
  const pauseAllForPerson = useMutation(api.dosages.pauseAllForPerson);

  const [editingSupplementId, setEditingSupplementId] =
    useState<Id<"supplements"> | null>(null);
  const [draft, setDraft] = useState(7);
  const [pausingDosageId, setPausingDosageId] =
    useState<Id<"dosages"> | null>(null);
  const [pausingAll, setPausingAll] = useState(false);
  const [pauseMode, setPauseMode] = useState<PauseMode>("indefinite");
  const [pauseUntilDraft, setPauseUntilDraft] = useState(
    toDateInput(Date.now() + 7 * 86_400_000)
  );
  const [busy, setBusy] = useState(false);

  if (!supplements || !dosages) {
    return <div className="px-4 py-4 text-sm text-text-muted">Loading...</div>;
  }

  const now = Date.now();
  const dosageBySupplement = new Map(dosages.map((d) => [d.supplementId, d]));
  const taking = supplements.filter((s) => {
    const dosage = dosageBySupplement.get(s._id);
    return dosage && !isDosagePaused(dosage, now);
  });
  const paused = supplements.filter((s) => {
    const dosage = dosageBySupplement.get(s._id);
    return dosage && isDosagePaused(dosage, now);
  });
  const notTaken = supplements.filter((s) => !dosageBySupplement.has(s._id));

  const openEditor = (supplementId: Id<"supplements">, weekly: number) => {
    setEditingSupplementId(supplementId);
    setPausingDosageId(null);
    setPausingAll(false);
    setDraft(weekly);
  };

  const openPause = (dosageId: Id<"dosages">, pauseUntil?: number) => {
    setPausingDosageId(dosageId);
    setPausingAll(false);
    setEditingSupplementId(null);
    setPauseMode(pauseUntil ? "date" : "indefinite");
    setPauseUntilDraft(toDateInput(pauseUntil ?? Date.now() + 7 * 86_400_000));
  };

  const openPauseAll = () => {
    setPausingAll(true);
    setPausingDosageId(null);
    setEditingSupplementId(null);
    setPauseMode("indefinite");
    setPauseUntilDraft(toDateInput(Date.now() + 7 * 86_400_000));
  };

  const pauseArgs = () =>
    pauseMode === "date"
      ? { pauseUntil: fromDateInput(pauseUntilDraft) }
      : { pauseUntil: undefined };

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

  const pauseOne = async (dosageId: Id<"dosages">) => {
    setBusy(true);
    try {
      await pauseDosage({ id: dosageId, ...pauseArgs() });
      setPausingDosageId(null);
    } finally {
      setBusy(false);
    }
  };

  const pauseAll = async () => {
    setBusy(true);
    try {
      await pauseAllForPerson({ personId, ...pauseArgs() });
      setPausingAll(false);
      setPausingDosageId(null);
    } finally {
      setBusy(false);
    }
  };

  const resume = async (dosageId: Id<"dosages">) => {
    setBusy(true);
    try {
      await resumeDosage({ id: dosageId });
    } finally {
      setBusy(false);
    }
  };

  const nameLink = (s: { _id: Id<"supplements">; name: string }) => (
    <Link
      href={`/supplements/${s._id}`}
      className="font-medium hover:text-primary hover:underline"
    >
      {s.name} <span className="text-text-muted">-&gt;</span>
    </Link>
  );

  const pauseControls = (onSave: () => void, label: string) => (
    <div className="mt-3 space-y-3 border-t border-border-strong pt-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPauseMode("indefinite")}
          className={`px-3 py-1.5 rounded-lg text-sm border ${
            pauseMode === "indefinite"
              ? "border-primary bg-primary-light text-primary"
              : "border-border-strong"
          }`}
        >
          Until resumed
        </button>
        <button
          type="button"
          onClick={() => setPauseMode("date")}
          className={`px-3 py-1.5 rounded-lg text-sm border ${
            pauseMode === "date"
              ? "border-primary bg-primary-light text-primary"
              : "border-border-strong"
          }`}
        >
          Until date
        </button>
        {pauseMode === "date" && (
          <input
            type="date"
            value={pauseUntilDraft}
            onChange={(e) => setPauseUntilDraft(e.target.value)}
            className="px-3 py-1.5 border border-border-strong rounded-lg text-sm"
          />
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={busy}
          className="btn-primary text-sm py-1.5 px-4 disabled:opacity-50"
        >
          {busy ? "Saving..." : label}
        </button>
        <button
          onClick={() => {
            setPausingDosageId(null);
            setPausingAll(false);
          }}
          className="btn-outline text-sm py-1.5 px-4"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="px-4 pb-4 pt-1 space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold text-text-label uppercase tracking-wide">
            Taking ({taking.length})
            {readOnly && taking.length > 0 && (
              <span className="ml-2 font-normal normal-case text-text-muted">
                - paused, re-enable to edit
              </span>
            )}
          </h3>
          {!readOnly && taking.length > 0 && (
            <button
              onClick={openPauseAll}
              className="text-sm text-primary hover:underline"
            >
              Pause all
            </button>
          )}
        </div>
        {pausingAll && pauseControls(pauseAll, "Pause all")}
        {taking.length === 0 ? (
          <p className="text-sm text-text-muted">Not taking anything active.</p>
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
                        {weekly}/wk - {perDay(weekly)}/day
                      </span>
                      {!readOnly && !isEditing && (
                        <>
                          <button
                            onClick={() => openPause(dosage._id)}
                            className="text-sm text-primary hover:underline"
                          >
                            Pause
                          </button>
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
                  {pausingDosageId === dosage._id &&
                    pauseControls(() => pauseOne(dosage._id), "Pause")}
                  {isEditing && (
                    <div className="mt-3 space-y-3 border-t border-border-strong pt-3">
                      <DosageInput value={draft} onChange={setDraft} />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(dosage._id)}
                          disabled={busy}
                          className="btn-primary text-sm py-1.5 px-4 disabled:opacity-50"
                        >
                          {busy ? "Saving..." : draft <= 0 ? "Remove" : "Save"}
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

      {paused.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-label uppercase tracking-wide mb-2">
            Paused ({paused.length})
          </h3>
          <div className="space-y-1.5">
            {paused.map((s) => {
              const dosage = dosageBySupplement.get(s._id)!;
              const weekly = getDosageWeekly(dosage);
              return (
                <div
                  key={s._id}
                  className="border border-primary/30 bg-primary-light/40 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      {nameLink(s)}
                      <div className="text-xs text-text-muted mt-1">
                        {pauseLabel(dosage.pauseUntil)} - {weekly}/wk saved
                      </div>
                    </div>
                    {!readOnly && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => resume(dosage._id)}
                          disabled={busy}
                          className="text-sm text-primary hover:underline disabled:opacity-50"
                        >
                          Resume
                        </button>
                        <button
                          onClick={() => openPause(dosage._id, dosage.pauseUntil)}
                          className="text-sm text-primary hover:underline"
                        >
                          Edit pause
                        </button>
                      </div>
                    )}
                  </div>
                  {pausingDosageId === dosage._id &&
                    pauseControls(() => pauseOne(dosage._id), "Save pause")}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                            {busy ? "Adding..." : "Add dosage"}
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
