"use client";

import { useState } from "react";
import type { FactsRowData } from "@/components/FactsView";

// What the editor hands back on save — matches api.supplementFacts.save args
// (minus supplementId), and is also what the Add form stages pre-create.
export interface FactsSavePayload {
  servingSize?: string;
  servingsPerContainer?: number;
  otherIngredients?: string;
  rows: FactsRowData[];
}

// A row while being edited: numeric fields as input strings, plus the original
// row so DSLD-only fields (operator, footnotes, category…) survive untouched.
interface DraftRow {
  base?: FactsRowData;
  name: string;
  amount: string;
  unit: string;
  dvPercent: string;
  level: number;
}

// Insights only sums amounts whose unit strings match exactly ("mg" ≠ "MG"),
// so suggest canonical spellings instead of leaving units fully free-form.
const UNIT_SUGGESTIONS = [
  "mg",
  "mcg",
  "g",
  "IU",
  "mg DFE",
  "mcg DFE",
  "mcg RAE",
  "mg NE",
  "billion CFU",
  "ml",
  "kcal",
];

function toDraftRow(row: FactsRowData): DraftRow {
  return {
    base: row,
    name: row.name,
    amount: row.amount != null ? String(row.amount) : "",
    unit: row.unit ?? "",
    dvPercent: row.dvPercent != null ? String(row.dvPercent) : "",
    level: row.level > 0 ? 1 : 0,
  };
}

const emptyDraftRow = (): DraftRow => ({
  name: "",
  amount: "",
  unit: "",
  dvPercent: "",
  level: 0,
});

function parseNum(s: string): number | undefined {
  const n = Number(s.trim());
  return s.trim() !== "" && Number.isFinite(n) ? n : undefined;
}

export function FactsEditorModal({
  initial,
  onSave,
  onClose,
}: {
  /** Existing facts to prefill, or null to start a blank manual entry. */
  initial: FactsSavePayload | null;
  onSave: (payload: FactsSavePayload) => Promise<void> | void;
  onClose: () => void;
}) {
  const [servingSize, setServingSize] = useState(initial?.servingSize ?? "");
  const [servingsPerContainer, setServingsPerContainer] = useState(
    initial?.servingsPerContainer != null
      ? String(initial.servingsPerContainer)
      : ""
  );
  const [otherIngredients, setOtherIngredients] = useState(
    initial?.otherIngredients ?? ""
  );
  const [rows, setRows] = useState<DraftRow[]>(() =>
    initial && initial.rows.length > 0
      ? initial.rows.map(toDraftRow)
      : [emptyDraftRow()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const namedRows = rows.filter((r) => r.name.trim());

  const patchRow = (i: number, patch: Partial<DraftRow>) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const moveRow = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };

  const handleSave = async () => {
    if (namedRows.length === 0) {
      setError("Add at least one ingredient row.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        servingSize: servingSize.trim() || undefined,
        servingsPerContainer: parseNum(servingsPerContainer),
        otherIngredients: otherIngredients.trim() || undefined,
        rows: namedRows.map((r) => ({
          ...(r.base ?? { isOther: false }),
          name: r.name.trim(),
          amount: parseNum(r.amount),
          unit: r.unit.trim() || undefined,
          dvPercent: parseNum(r.dvPercent),
          level: r.level,
        })),
      });
      onClose();
    } catch (err) {
      console.error("Failed to save facts:", err);
      setError("Failed to save facts. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 bg-surface rounded-lg max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-card">
        {/* Header */}
        <div className="border-b border-border-strong p-6 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold">
              {initial ? "Edit supplement facts" : "Enter supplement facts"}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Copy the Supplement Facts panel from the bottle label.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="overflow-auto flex-1 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-text-label">
                Serving size
              </label>
              <input
                type="text"
                placeholder="e.g., 2 capsules"
                value={servingSize}
                onChange={(e) => setServingSize(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-border-strong rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-label">
                Servings per container
              </label>
              <input
                type="number"
                min={0}
                placeholder="e.g., 60"
                value={servingsPerContainer}
                onChange={(e) => setServingsPerContainer(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-border-strong rounded-lg font-mono text-sm"
              />
            </div>
          </div>

          {/* Ingredient rows */}
          <div>
            <div className="flex text-[11px] font-semibold text-text-muted gap-2 pb-1">
              <span className="flex-1 pl-7">Ingredient (amount per serving)</span>
              <span className="w-20">Amount</span>
              <span className="w-24">Unit</span>
              <span className="w-14">% DV</span>
              <span className="w-[72px]" />
            </div>
            <div className="space-y-1.5">
              {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  {/* Indent toggle: sub-ingredient of the row above (e.g. a
                      blend component). First row has nothing to nest under. */}
                  <button
                    type="button"
                    onClick={() =>
                      patchRow(i, { level: row.level > 0 ? 0 : 1 })
                    }
                    disabled={i === 0}
                    title={
                      row.level > 0
                        ? "Outdent to top level"
                        : "Indent under the row above"
                    }
                    className={`w-5 flex-shrink-0 text-sm disabled:opacity-20 ${
                      row.level > 0
                        ? "text-primary"
                        : "text-text-muted hover:text-text"
                    }`}
                  >
                    {row.level > 0 ? "└" : "→"}
                  </button>
                  <input
                    type="text"
                    placeholder={
                      row.level > 0 ? "sub-ingredient" : "e.g., Vitamin D3"
                    }
                    value={row.name}
                    onChange={(e) => patchRow(i, { name: e.target.value })}
                    className={`flex-1 min-w-0 px-2 py-1.5 border border-border-strong rounded-lg text-sm ${
                      row.level > 0 ? "ml-4" : ""
                    }`}
                  />
                  <input
                    type="number"
                    placeholder="amt"
                    value={row.amount}
                    onChange={(e) => patchRow(i, { amount: e.target.value })}
                    className="w-20 px-2 py-1.5 border border-border-strong rounded-lg font-mono text-sm"
                  />
                  <input
                    type="text"
                    placeholder="mg"
                    list="facts-unit-suggestions"
                    value={row.unit}
                    onChange={(e) => patchRow(i, { unit: e.target.value })}
                    className="w-24 px-2 py-1.5 border border-border-strong rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    placeholder="%"
                    value={row.dvPercent}
                    onChange={(e) => patchRow(i, { dvPercent: e.target.value })}
                    className="w-14 px-2 py-1.5 border border-border-strong rounded-lg font-mono text-sm"
                  />
                  <div className="w-[72px] flex-shrink-0 flex items-center gap-1 text-text-muted">
                    <button
                      type="button"
                      onClick={() => moveRow(i, -1)}
                      disabled={i === 0}
                      title="Move up"
                      className="hover:text-text disabled:opacity-20"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRow(i, 1)}
                      disabled={i === rows.length - 1}
                      title="Move down"
                      className="hover:text-text disabled:opacity-20"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRows(rows.filter((_, idx) => idx !== i))
                      }
                      title="Remove row"
                      className="hover:text-critical text-base leading-none"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <datalist id="facts-unit-suggestions">
              {UNIT_SUGGESTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={() => setRows([...rows, emptyDraftRow()])}
              className="mt-2 w-full px-3 py-1.5 border border-dashed border-primary/50 rounded-lg hover:bg-primary-light/50 transition-colors text-sm"
            >
              + Add ingredient row
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-label">
              Other ingredients
            </label>
            <textarea
              rows={2}
              placeholder="e.g., Gelatin, glycerin, purified water"
              value={otherIngredients}
              onChange={(e) => setOtherIngredients(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border-strong rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border-strong p-4 flex items-center gap-3 flex-shrink-0">
          {error && <span className="text-critical text-xs">{error}</span>}
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onClose} className="btn-outline">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save facts"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
