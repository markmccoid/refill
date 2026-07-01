"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { DosageInput } from "@/components/DosageInput";

interface Candidate {
  _id: Id<"supplements">;
  name: string;
  brand?: string;
}
interface Person {
  _id: Id<"people">;
  name: string;
}

/**
 * Create a group from ≥2 interchangeable brands (ADR-0004). Group dosage is
 * confirmed here and materialised onto every member; any prior per-brand dosages
 * are discarded (option B). Consumption order is date-FIFO (not arranged here).
 */
export function CreateGroupDialog({
  householdId,
  candidates,
  people,
  onClose,
}: {
  householdId: Id<"households">;
  candidates: Candidate[];
  people: Person[];
  onClose: () => void;
}) {
  const createGroup = useMutation(api.groups.create);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [weekly, setWeekly] = useState<Record<string, number>>(() =>
    Object.fromEntries(people.map((p) => [p._id, 7]))
  );
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canCreate = name.trim().length > 0 && selected.size >= 2 && !busy;

  const submit = async () => {
    if (!canCreate) return;
    setBusy(true);
    try {
      await createGroup({
        householdId,
        name: name.trim(),
        category: category.trim() || undefined,
        supplementIds: [...selected] as Id<"supplements">[],
        dosages: people.map((p) => ({
          personId: p._id,
          pillsPerWeek: weekly[p._id] ?? 0,
        })),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-xl font-bold tracking-tight">Create a group</h2>
          <p className="text-sm text-text-muted mt-1">
            Group brands that are interchangeable — taken one at a time until each
            runs out, then the next.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-text-label uppercase tracking-wide">
              Group name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fish Oil"
              className="mt-1 w-full border border-black/15 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-label uppercase tracking-wide">
              Category (optional)
            </label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Essential fatty acid"
              className="mt-1 w-full border border-black/15 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-text-label uppercase tracking-wide mb-2">
            Brands in this group (pick 2+)
          </p>
          {candidates.length === 0 ? (
            <p className="text-sm text-text-muted">
              No ungrouped supplements available to group.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {candidates.map((c) => (
                <label
                  key={c._id}
                  className="flex items-center gap-3 border border-black/10 rounded-lg p-2.5 cursor-pointer hover:bg-surface-alt"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c._id)}
                    onChange={() => toggle(c._id)}
                  />
                  <span className="text-sm font-medium">{c.name}</span>
                  {c.brand && (
                    <span className="text-sm text-text-muted">· {c.brand}</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-text-label uppercase tracking-wide mb-1">
            Group dosage (brands inherit this)
          </p>
          <p className="text-xs text-text-muted mb-2">
            Prior per-brand dosages are replaced. Override a brand later if it
            differs.
          </p>
          <div className="space-y-3">
            {people.map((p) => (
              <div key={p._id} className="flex items-center gap-3">
                <span className="w-20 text-sm font-medium">{p.name}</span>
                <div className="flex-1">
                  <DosageInput
                    value={weekly[p._id] ?? 0}
                    onChange={(v) =>
                      setWeekly((prev) => ({ ...prev, [p._id]: v }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-outline text-sm py-2 px-4">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canCreate}
            className="btn-primary text-sm py-2 px-4 disabled:opacity-40"
          >
            {busy ? "Creating…" : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
}
