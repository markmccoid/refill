"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

/**
 * The Restock Plan's only membership editor (ADR-0006): every subject (solo
 * supplement or group), sorted soonest-run-out first, checkbox-selected.
 * Pre-checked = already on the plan; unchecking removes (confirming first when
 * the item has entered prices or a selection that would be discarded).
 */
export function RestockPickerModal({
  householdId,
  onClose,
}: {
  householdId: Id<"households">;
  onClose: () => void;
}) {
  const data = useQuery(api.restock.picker, { householdId });
  const setPlan = useMutation(api.restock.setPlan);

  const [checked, setChecked] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);

  // Initialise the checked set from current plan membership once loaded.
  useEffect(() => {
    if (data && checked === null) {
      setChecked(
        new Set(
          data.subjects
            .filter((s) => s.onPlan)
            .map((s) => (s.groupId ?? s.supplementId) as string)
        )
      );
    }
  }, [data, checked]);

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = async () => {
    if (!data || !checked || busy) return;
    // Unchecking an item that already has prices/selection discards that work.
    const losingWork = data.subjects.filter(
      (s) =>
        s.hasPlanWork && !checked.has((s.groupId ?? s.supplementId) as string)
    );
    if (
      losingWork.length > 0 &&
      !window.confirm(
        `Removing ${losingWork.map((s) => s.name).join(", ")} will discard the prices you've entered for ${losingWork.length === 1 ? "it" : "them"}. Remove anyway?`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await setPlan({
        householdId,
        supplementIds: data.subjects
          .filter((s) => s.supplementId && checked.has(s.supplementId))
          .map((s) => s.supplementId!) as Id<"supplements">[],
        groupIds: data.subjects
          .filter((s) => s.groupId && checked.has(s.groupId))
          .map((s) => s.groupId!) as Id<"groups">[],
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
        className="bg-surface rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-3 border-b border-black/7">
          <h2 className="text-lg font-bold">Choose supplements to restock</h2>
          <p className="text-xs text-text-muted mt-1">
            Sorted by run-out.{" "}
            {data
              ? `Highlighted items run out within ${data.forecastWindowDays} days.`
              : ""}
          </p>
        </div>

        <div className="flex-1 overflow-auto px-3 py-2">
          {!data || checked === null ? (
            <div className="text-center text-sm text-text-muted py-8">
              Loading…
            </div>
          ) : data.subjects.length === 0 ? (
            <div className="text-center text-sm text-text-muted py-8">
              No supplements yet — add some first.
            </div>
          ) : (
            data.subjects.map((s) => {
              const id = (s.groupId ?? s.supplementId) as string;
              const isChecked = checked.has(id);
              return (
                <label
                  key={id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    s.urgent ? "bg-amber-50" : ""
                  } hover:bg-black/5`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(id)}
                    className="w-4 h-4 accent-emerald-600"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <span className="truncate">{s.name}</span>
                      {s.kind === "group" && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-primary-light text-primary px-1.5 py-0.5 rounded">
                          Group
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-text-muted">
                      {Math.round(s.onHand)} on hand
                    </span>
                  </span>
                  <span
                    className={`text-xs font-semibold whitespace-nowrap ${
                      s.urgent ? "text-amber-600" : "text-text-muted"
                    }`}
                  >
                    {s.daysLeft === null
                      ? "no forecast"
                      : s.daysLeft <= 0
                        ? "out now"
                        : `${s.daysLeft}d left`}
                  </span>
                </label>
              );
            })
          )}
        </div>

        <div className="px-6 py-4 border-t border-black/7 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={!data || checked === null || busy}
            className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
          >
            {busy ? "Saving…" : "Update plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
