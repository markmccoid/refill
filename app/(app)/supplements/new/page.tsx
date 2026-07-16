"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useHousehold } from "@/hooks/useHousehold";
import { ImageUploader } from "@/components/ImageUploader";
import {
  DsldFindDetails,
  type DsldLabel,
  type DsldFindDetailsHandle,
} from "@/components/DsldFindDetails";
import { DosageInput } from "@/components/DosageInput";
import { BottleFields, type BottleFieldsValue } from "@/components/BottleFields";
import { FactsView } from "@/components/FactsView";
import {
  FactsEditorModal,
  type FactsSavePayload,
} from "@/components/FactsEditorModal";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";

interface Nutrient {
  name: string;
  amount: number;
  unit: string;
}

interface DosageAssignment {
  personId: Id<"people">;
  pillsPerWeek: number;
}

function toDateInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function fromDateInput(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0).getTime();
}
function storeLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const emptyBottleDraft = (count: number): BottleFieldsValue => ({
  count,
  price: 0,
  purchaseUrl: "",
  purchasedAt: toDateInput(Date.now()),
  remaining: count,
});

export default function AddSupplementPage() {
  const router = useRouter();
  const householdId = useHousehold();
  const people = useQuery(
    api.people.list,
    householdId ? { householdId } : "skip"
  );
  const createSupplement = useMutation(api.supplements.create);
  const createDosage = useMutation(api.dosages.create);
  const importFacts = useAction(api.dsld.importFacts);
  const saveFacts = useMutation(api.supplementFacts.save);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Facts staged for submit: the picked DSLD label (full parsed label so we
  // can preview it before save), or a hand-entered draft. Mutually exclusive —
  // a supplement has one facts record.
  const [pendingLabel, setPendingLabel] = useState<DsldLabel | null>(null);
  const [manualFacts, setManualFacts] = useState<FactsSavePayload | null>(null);
  const [factsEditorOpen, setFactsEditorOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    brand: "",
    form: "",
    servingSize: "",
    category: "",
    nutrients: [] as Nutrient[],
    jarSize: 120,
    imageUrl: "",
  });

  // Bottles added so far, plus the in-progress draft (shown only when adding).
  const [bottles, setBottles] = useState<BottleFieldsValue[]>([]);
  const [addingBottle, setAddingBottle] = useState(false);
  const [bottleDraft, setBottleDraft] = useState<BottleFieldsValue>(
    emptyBottleDraft(120)
  );
  const [bottleQty, setBottleQty] = useState(1);

  const [dosages, setDosages] = useState<DosageAssignment[]>([]);

  const findDetailsRef = useRef<DsldFindDetailsHandle>(null);

  function applyDsldLabel(label: DsldLabel) {
    setPendingLabel(label);
    setManualFacts(null);
    setError("");
    const jarSize = label.jarSizeSuggestion ?? formData.jarSize;
    setFormData((prev) => ({
      ...prev,
      name: label.fullName || prev.name,
      brand: label.brandName ?? "",
      form: label.form ?? "",
      servingSize: label.servingSize ?? "",
      category: label.category ?? "",
      nutrients: label.nutrientHighlights,
      jarSize,
    }));
    setBottleDraft((prev) => ({
      ...prev,
      count: jarSize,
      remaining:
        prev.remaining === prev.count
          ? jarSize
          : Math.min(prev.remaining, jarSize),
    }));
  }

  function openNewBottle(draft?: BottleFieldsValue) {
    setBottleDraft(draft ?? emptyBottleDraft(formData.jarSize));
    setBottleQty(1);
    setAddingBottle(true);
  }

  function cancelNewBottle() {
    setAddingBottle(false);
    setBottleDraft(emptyBottleDraft(formData.jarSize));
    setBottleQty(1);
  }

  function addBottleToList() {
    if (bottleDraft.count <= 0) {
      setError("Bottle count must be greater than 0");
      return;
    }
    const entry = {
      ...bottleDraft,
      remaining: Math.max(0, Math.min(bottleDraft.remaining, bottleDraft.count)),
    };
    // qty > 1 = several identical bottles from one order; each is its own row.
    setBottles([...bottles, ...Array(bottleQty).fill(entry)]);
    setAddingBottle(false);
    setBottleDraft(emptyBottleDraft(formData.jarSize));
    setBottleQty(1);
    setError("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!householdId) {
      setError("Household not initialized");
      return;
    }
    if (!formData.name.trim()) {
      setError("Supplement name is required");
      return;
    }
    if (formData.jarSize <= 0) {
      setError("Default bottle size must be greater than 0");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const supplementId = await createSupplement({
        householdId,
        name: formData.name,
        brand: formData.brand || undefined,
        form: formData.form || undefined,
        servingSize: formData.servingSize || undefined,
        category: formData.category || undefined,
        nutrients: formData.nutrients.length ? formData.nutrients : undefined,
        jarSize: formData.jarSize,
        imageUrl: formData.imageUrl || undefined,
        bottles: bottles.map((b) => ({
          count: b.count,
          price: b.price,
          purchaseUrl: b.purchaseUrl || undefined,
          purchasedAt: fromDateInput(b.purchasedAt),
          remaining: Math.max(0, Math.min(b.remaining, b.count)),
        })),
      });

      for (const dosage of dosages) {
        await createDosage({
          supplementId,
          personId: dosage.personId,
          pillsPerWeek: dosage.pillsPerWeek,
        });
      }

      if (pendingLabel) {
        try {
          await importFacts({ supplementId, dsldId: pendingLabel.dsldId });
        } catch (err) {
          console.error("Failed to import DSLD facts:", err);
        }
      } else if (manualFacts) {
        try {
          await saveFacts({ supplementId, ...manualFacts });
        } catch (err) {
          console.error("Failed to save manual facts:", err);
        }
      }

      router.push("/supplements");
    } catch (err) {
      console.error("Failed to save supplement:", err);
      setError("Failed to save supplement. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Add a supplement</h1>
        <p className="text-text-muted text-sm mt-1">
          Enter the supplement details, then add your bottles.
        </p>
      </div>

      {error && (
        <div className="bg-critical-light border border-critical/25 text-critical px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSave}
        onKeyDown={(e) => {
          // Enter in any field must not save; only the Save button submits.
          // (Buttons stay clickable via Enter — their default is a click.)
          const target = e.target as HTMLElement;
          if (
            e.key === "Enter" &&
            target.tagName !== "BUTTON" &&
            target.tagName !== "TEXTAREA"
          ) {
            e.preventDefault();
          }
        }}
        className="space-y-4"
      >
        {/* Identity */}
        <div>
          <label className="text-xs font-semibold text-text-label">
            Supplement name *
          </label>
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              placeholder="e.g., Omega-3 Fish Oil"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  findDetailsRef.current?.open();
                }
              }}
              className="flex-1 px-4 py-2 border border-border-strong rounded-lg font-medium text-sm"
            />
            <DsldFindDetails
              ref={findDetailsRef}
              initialQuery={formData.name}
              onApply={applyDsldLabel}
              onManualEntry={() => setFactsEditorOpen(true)}
            />
          </div>
          <p className="text-xs text-text-muted mt-1">
            Type a name, then{" "}
            <span className="font-medium">Find Details</span> to pull the
            official label & facts from the NIH database
            {!pendingLabel && !manualFacts ? (
              <>
                , or{" "}
                <button
                  type="button"
                  onClick={() => setFactsEditorOpen(true)}
                  className="text-primary hover:underline"
                >
                  enter the facts manually
                </button>
                .
              </>
            ) : (
              "."
            )}
          </p>
        </div>

        {pendingLabel && (
          <div className="bg-primary-light border border-primary/30 rounded-lg px-4 py-3 text-sm flex items-start justify-between gap-3">
            <div>
              <span className="font-semibold text-primary">
                ✓ Linked to DSLD #{pendingLabel.dsldId}
              </span>
              <p className="text-text-muted text-xs mt-0.5">
                {[formData.brand, formData.form, formData.servingSize]
                  .filter(Boolean)
                  .join(" · ")}
                {" — supplement facts & label image will be saved."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPendingLabel(null)}
              className="text-xs text-text-muted hover:text-critical flex-shrink-0"
            >
              Unlink
            </button>
          </div>
        )}

        {manualFacts && (
          <div className="bg-primary-light border border-primary/30 rounded-lg px-4 py-3 text-sm flex items-start justify-between gap-3">
            <span className="font-semibold text-primary">
              ✓ Facts entered manually — will be saved with the supplement.
            </span>
            <div className="flex gap-3 flex-shrink-0 text-xs">
              <button
                type="button"
                onClick={() => setFactsEditorOpen(true)}
                className="text-primary hover:underline"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setManualFacts(null)}
                className="text-text-muted hover:text-critical"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {/* Preview the staged facts (DSLD pick or manual entry) before save. */}
        {(pendingLabel || manualFacts) && (
          <div className="border border-border-strong rounded-lg p-4 max-h-80 overflow-auto">
            <h3 className="text-sm font-semibold mb-3">
              Supplement Facts preview
            </h3>
            <FactsView
              facts={
                pendingLabel
                  ? {
                      servingSize: pendingLabel.servingSize,
                      servingsPerContainer: pendingLabel.servingsPerContainer,
                      rows: pendingLabel.rows,
                      otherIngredients: pendingLabel.otherIngredients,
                      offMarket: pendingLabel.offMarket,
                      thumbnailUrl: pendingLabel.thumbnailUrl,
                      dsldId: pendingLabel.dsldId,
                    }
                  : manualFacts!
              }
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-text-label">
              Brand
            </label>
            <input
              type="text"
              placeholder="e.g., Thorne"
              value={formData.brand}
              onChange={(e) =>
                setFormData({ ...formData, brand: e.target.value })
              }
              className="w-full mt-1 px-4 py-2 border border-border-strong rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-label">
              Form
            </label>
            <input
              type="text"
              placeholder="e.g., Softgel"
              value={formData.form}
              onChange={(e) =>
                setFormData({ ...formData, form: e.target.value })
              }
              className="w-full mt-1 px-4 py-2 border border-border-strong rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-text-label">
              Serving size
            </label>
            <input
              type="text"
              placeholder="e.g., 1 softgel"
              value={formData.servingSize}
              onChange={(e) =>
                setFormData({ ...formData, servingSize: e.target.value })
              }
              className="w-full mt-1 px-4 py-2 border border-border-strong rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-label">
              Default bottle size (pills)
            </label>
            <input
              type="number"
              min={1}
              value={formData.jarSize || ""}
              onChange={(e) => {
                const jarSize = Math.max(0, parseInt(e.target.value) || 0);
                setFormData({ ...formData, jarSize });
                setBottleDraft((prev) => ({
                  ...prev,
                  count: jarSize,
                  remaining:
                    prev.remaining === prev.count
                      ? jarSize
                      : Math.min(prev.remaining, jarSize),
                }));
              }}
              className="w-full mt-1 px-4 py-2 border border-border-strong rounded-lg font-mono text-sm"
            />
          </div>
        </div>

        <ImageUploader
          imageUrl={formData.imageUrl}
          onImageChange={(url) => setFormData({ ...formData, imageUrl: url })}
        />

        {/* Bottles */}
        <div className="border border-border-strong rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Bottles</h3>
            <span className="text-xs text-text-muted">
              {bottles.length} added
            </span>
          </div>

          {bottles.length > 0 && (
            <div className="space-y-1">
              {bottles.map((b, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 text-sm border border-border-strong rounded-lg px-3 py-2"
                >
                  <span className="font-mono">{b.count} ct</span>
                  <span className="font-mono">${b.price.toFixed(2)}</span>
                  {b.purchaseUrl && (
                    <span className="text-xs text-text-muted truncate">
                      {storeLabel(b.purchaseUrl)}
                    </span>
                  )}
                  <span className="text-xs text-text-muted ml-auto">
                    {b.purchasedAt}
                  </span>
                  <button
                    type="button"
                    onClick={() => openNewBottle({ ...b })}
                    className="text-xs text-primary hover:underline"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBottles(bottles.filter((_, i) => i !== idx))
                    }
                    className="text-xs text-critical hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-border-strong pt-3">
            {addingBottle ? (
              <div className="space-y-2">
                <BottleFields
                  value={bottleDraft}
                  onChange={setBottleDraft}
                  quantity={bottleQty}
                  onQuantityChange={setBottleQty}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addBottleToList}
                    className="btn-primary flex-1 text-sm py-1.5"
                  >
                    {bottleQty > 1 ? `Save ${bottleQty} bottles` : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelNewBottle}
                    className="btn-outline flex-1 text-sm py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openNewBottle()}
                className="btn-outline w-full text-sm"
              >
                + Add New Bottle
              </button>
            )}
          </div>

          {bottles.length === 0 && !addingBottle && (
            <p className="text-xs text-text-muted">
              Add at least one bottle to track stock & spend (you can also add
              bottles later).
            </p>
          )}
        </div>

        {/* Dosages */}
        {people && people.some((p) => p.status !== "disabled") && (
          <div className="border-t border-border-strong pt-4">
            <h3 className="text-sm font-semibold mb-3">
              Who takes this? (optional)
            </h3>
            <div className="space-y-3">
              {people
                .filter((p) => p.status !== "disabled")
                .map((person) => {
                const personDosage = dosages.find(
                  (d) => d.personId === person._id
                );
                return (
                  <div
                    key={person._id}
                    className="border border-border-strong rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id={`person-${person._id}`}
                        checked={!!personDosage}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDosages([
                              ...dosages,
                              { personId: person._id, pillsPerWeek: 7 },
                            ]);
                          } else {
                            setDosages(
                              dosages.filter((d) => d.personId !== person._id)
                            );
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <label
                        htmlFor={`person-${person._id}`}
                        className="text-sm font-medium"
                      >
                        {person.name}
                      </label>
                    </div>

                    {personDosage && (
                      <div className="ml-6">
                        <DosageInput
                          value={personDosage.pillsPerWeek}
                          onChange={(pillsPerWeek) =>
                            setDosages(
                              dosages.map((d) =>
                                d.personId === person._id
                                  ? { ...d, pillsPerWeek }
                                  : d
                              )
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save supplement"}
          </button>
          <Link href="/supplements" className="btn-outline flex-1 text-center">
            Cancel
          </Link>
        </div>
      </form>

      <div className="text-center">
        <Link
          href="/supplements"
          className="text-sm text-primary hover:underline"
        >
          ← Back to supplements
        </Link>
      </div>

      {factsEditorOpen && (
        <FactsEditorModal
          initial={manualFacts}
          onSave={(payload) => {
            // Stage the draft; it's written after the supplement is created.
            setManualFacts(payload);
            setPendingLabel(null);
          }}
          onClose={() => setFactsEditorOpen(false)}
        />
      )}
    </div>
  );
}
