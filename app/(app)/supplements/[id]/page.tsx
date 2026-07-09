"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { ImageUploader } from "@/components/ImageUploader";
import {
  DsldFindDetails,
  type DsldLabel,
  type DsldFindDetailsHandle,
} from "@/components/DsldFindDetails";
import { SupplementFactsPanel } from "@/components/SupplementFactsPanel";
import { DosageInput } from "@/components/DosageInput";
import { BottleFields } from "@/components/BottleFields";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  getSupplementStatus,
  getDaysLeft,
  getConsumptionRate,
  getBottleStatesForDosages,
  getGroupStateForDosages,
  getSpendRatePerDay,
  getLifetimeSpent,
  getDosageWeekly,
  type BottleState,
} from "@/lib/supplement-utils";

// --- date <-> <input type="date"> helpers (local noon avoids tz drift) -------
function toDateInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function fromDateInput(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}
/** Short store label for a purchase link, e.g. "amazon.com". */
function storeLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function SupplementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supplementId = params.id as Id<"supplements">;

  const supplement = useQuery(api.supplements.get, { id: supplementId });
  const dosages = useQuery(
    api.dosages.listBySupplementId,
    supplement ? { supplementId } : "skip"
  );
  const people = useQuery(
    api.people.list,
    supplement ? { householdId: supplement.householdId } : "skip"
  );
  const bottles = useQuery(
    api.bottles.listBySupplement,
    supplement ? { supplementId } : "skip"
  );
  // The group this brand belongs to (null if ungrouped). When grouped, on-hand
  // and per-bottle state come from the pooled FIFO walk, not this brand alone —
  // so a sealed brand shows frozen instead of falsely depleting (ADR-0004).
  const group = useQuery(
    api.groups.getForSupplement,
    supplement ? { supplementId } : "skip"
  );
  // Only used to warn before a DSLD re-import clobbers hand-edited facts
  // (the facts panel itself runs its own copy of this query).
  const facts = useQuery(
    api.supplementFacts.getBySupplementId,
    supplement ? { supplementId } : "skip"
  );

  const updateSupplement = useMutation(api.supplements.update);
  const removeSupplement = useMutation(api.supplements.remove);
  const createDosage = useMutation(api.dosages.create);
  const updateDosage = useMutation(api.dosages.update);
  const removeDosage = useMutation(api.dosages.remove);
  const setGroupDosage = useMutation(api.groups.setDosage);
  const addBottle = useMutation(api.bottles.add);
  const updateBottle = useMutation(api.bottles.update);
  const removeBottle = useMutation(api.bottles.remove);
  const recountBottle = useMutation(api.bottles.recount);
  const importFacts = useAction(api.dsld.importFacts);

  const [isEditing, setIsEditing] = useState(false);
  const [pendingDsldId, setPendingDsldId] = useState<string | null>(null);
  const [pendingNutrients, setPendingNutrients] = useState<
    { name: string; amount: number; unit: string }[] | null
  >(null);
  const [editData, setEditData] = useState({
    name: "",
    brand: "",
    form: "",
    servingSize: "",
    category: "",
    jarSize: 0,
    imageUrl: "",
  });

  // Bottle add / edit form state.
  const [addingBottle, setAddingBottle] = useState(false);
  const [newBottle, setNewBottle] = useState({
    count: 0,
    price: 0,
    purchaseUrl: "",
    purchasedAt: toDateInput(Date.now()),
  });
  const [newBottleQty, setNewBottleQty] = useState(1);
  const [editingBottleId, setEditingBottleId] =
    useState<Id<"bottles"> | null>(null);
  const [editBottle, setEditBottle] = useState({
    count: 0,
    price: 0,
    purchaseUrl: "",
    purchasedAt: toDateInput(Date.now()),
    remaining: 0,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addingDosageFor, setAddingDosageFor] = useState<Id<"people"> | null>(
    null
  );
  const [newDosagePillsPerWeek, setNewDosagePillsPerWeek] = useState(7);
  const [editingDosageId, setEditingDosageId] =
    useState<Id<"dosages"> | null>(null);
  const [editDosagePillsPerWeek, setEditDosagePillsPerWeek] = useState(7);

  const findDetailsRef = useRef<DsldFindDetailsHandle>(null);

  // `supplement === null` means the doc is gone (e.g. just deleted, or a stale
  // link) — send them back to the list instead of showing "Loading..." forever.
  useEffect(() => {
    if (supplement === null) router.replace("/supplements");
  }, [supplement, router]);

  if (!supplement || !dosages || !people || !bottles || group === undefined) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const lifetime = getLifetimeSpent(bottles);
  const anchoredAt = supplement.anchoredAt ?? supplement.createdAt ?? Date.now();

  // Bottle states + on-hand come from the group's pooled FIFO walk when grouped
  // (this brand's bottles are frozen unless it owns the group-open bottle), or
  // from this brand alone otherwise. Forecast & spend are group-level when
  // grouped, since only one brand is consumed at a time (ADR-0004).
  let rate: number;
  let states: BottleState<Doc<"bottles">>[];
  let onHand: number;
  let bottleCount: number;
  let incomingCount: number;
  let nextIncomingAt: number | null;
  let openRemaining: number;
  let openCostPerPill: number;
  let daysLeft: number;
  let monthlySpend: number;

  if (group) {
    rate = group.consumptionRate;
    const memberInput = group.members.map((m) => ({
      supplementId: m.supplement._id as string,
      bottles: m.bottles,
    }));
    const gl = getGroupStateForDosages(
      memberInput,
      group.anchoredAt,
      group.dosages ?? []
    );
    states = gl.states.filter((s) => s.bottle.supplementId === supplementId);
    const availableStates = states.filter((s) => s.bottle.purchasedAt <= Date.now());
    const incomingStates = states.filter(
      (s) => s.bottle.purchasedAt > Date.now() && s.remaining > 0
    );
    onHand = Math.round(availableStates.reduce((sum, s) => sum + s.remaining, 0));
    incomingCount = Math.round(
      incomingStates.reduce((sum, s) => sum + s.remaining, 0)
    );
    nextIncomingAt =
      incomingStates.length > 0 ? incomingStates[0].bottle.purchasedAt : null;
    const ne = availableStates.filter((s) => s.remaining > 0);
    bottleCount = ne.length;
    const openHere = states.find((s) => s.isOpen);
    openRemaining = openHere ? Math.round(openHere.remaining) : 0;
    openCostPerPill = gl.openCostPerPill;
    daysLeft = getDaysLeft(gl.onHand, rate); // the group's run-out
    monthlySpend = getSpendRatePerDay(rate, gl.openCostPerPill) * 30;
  } else {
    rate = getConsumptionRate(dosages.filter((d) => d.personActive));
    const activeDosages = dosages.filter((d) => d.personActive);
    const ledger = getBottleStatesForDosages(bottles, anchoredAt, activeDosages);
    states = ledger.states;
    onHand = ledger.onHand;
    bottleCount = ledger.bottleCount;
    incomingCount = ledger.incomingCount;
    nextIncomingAt = ledger.nextIncomingAt;
    openRemaining = ledger.openRemaining;
    openCostPerPill = ledger.openCostPerPill;
    daysLeft = getDaysLeft(ledger.onHand, rate);
    monthlySpend = getSpendRatePerDay(rate, ledger.openCostPerPill) * 30;
  }

  const ledger = {
    onHand,
    bottleCount,
    incomingCount,
    nextIncomingAt,
    openRemaining,
    openCostPerPill,
    states,
  };
  const status = getSupplementStatus(daysLeft);
  const openState = states.find((s) => s.isOpen);
  const now = Date.now();
  const nonEmpty = states.filter(
    (s) => s.bottle.purchasedAt <= now && s.remaining > 0
  );
  const incoming = states.filter(
    (s) => s.bottle.purchasedAt > now && s.remaining > 0
  );
  const empty = states.filter(
    (s) => s.bottle.purchasedAt <= now && s.remaining <= 0
  );

  // Distinct purchase links across all bottles, newest purchase first.
  const purchaseLinks = Array.from(
    new Set(
      [...bottles]
        .sort((a, b) => b.purchasedAt - a.purchasedAt)
        .map((b) => b.purchaseUrl)
        .filter((u): u is string => !!u)
    )
  );

  // Fill identity/label fields from a chosen DSLD product (inventory untouched).
  const applyDsldLabel = (label: DsldLabel) => {
    setPendingDsldId(label.dsldId);
    setPendingNutrients(label.nutrientHighlights);
    setError("");
    setEditData((prev) => ({
      ...prev,
      name: label.fullName || prev.name,
      brand: label.brandName ?? "",
      form: label.form ?? "",
      servingSize: label.servingSize ?? "",
      category: label.category ?? "",
    }));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData.name.trim()) {
      setError("Name is required");
      return;
    }
    if (editData.jarSize <= 0) {
      setError("Default bottle size must be greater than 0");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await updateSupplement({
        id: supplementId,
        name: editData.name,
        brand: editData.brand || undefined,
        form: editData.form || undefined,
        servingSize: editData.servingSize || undefined,
        category: editData.category || undefined,
        nutrients: pendingNutrients ?? undefined,
        jarSize: editData.jarSize,
        imageUrl: editData.imageUrl || undefined,
      });

      // Attach/refresh DSLD facts + label images if a product was picked.
      // Hand-edited facts are user work — confirm before replacing them.
      if (
        pendingDsldId &&
        (!facts?.edited ||
          confirm(
            `Replace your edited supplement facts with DSLD #${pendingDsldId}?`
          ))
      ) {
        try {
          await importFacts({ supplementId, dsldId: pendingDsldId });
        } catch (err) {
          console.error("Failed to import DSLD facts:", err);
        }
      }

      setPendingDsldId(null);
      setPendingNutrients(null);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update:", err);
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${supplement.name}"? This cannot be undone.`)) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await removeSupplement({ id: supplementId });
      router.push("/supplements");
    } catch (err) {
      console.error("Failed to delete:", err);
      setError("Failed to delete supplement");
      setSaving(false);
    }
  };

  const handleAddBottle = async () => {
    if (newBottle.count <= 0) {
      setError("Bottle count must be greater than 0");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await addBottle({
        supplementId,
        count: newBottle.count,
        price: newBottle.price,
        purchaseUrl: newBottle.purchaseUrl || undefined,
        purchasedAt: fromDateInput(newBottle.purchasedAt),
        qty: newBottleQty,
      });
      setAddingBottle(false);
      setNewBottle({
        count: supplement.jarSize,
        price: 0,
        purchaseUrl: "",
        purchasedAt: toDateInput(Date.now()),
      });
      setNewBottleQty(1);
    } catch (err) {
      console.error("Failed to add bottle:", err);
      setError("Failed to add bottle");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBottle = async (id: Id<"bottles">, currentRemaining: number) => {
    setSaving(true);
    setError("");
    try {
      await updateBottle({
        id,
        count: editBottle.count,
        price: editBottle.price,
        purchaseUrl: editBottle.purchaseUrl, // "" clears it (see bottles.update)
        purchasedAt: fromDateInput(editBottle.purchasedAt),
      });
      // If the user corrected the on-hand count, apply it as a recount.
      if (Math.round(editBottle.remaining) !== Math.round(currentRemaining)) {
        await recountBottle({ id, remaining: editBottle.remaining });
      }
      setEditingBottleId(null);
    } catch (err) {
      console.error("Failed to update bottle:", err);
      setError("Failed to update bottle");
    } finally {
      setSaving(false);
    }
  };

  // "Bought this again": open the add-bottle form pre-filled from an existing
  // bottle (same size/price/store), dated today, ready to confirm.
  const duplicateBottle = (bottle: Doc<"bottles">) => {
    setNewBottle({
      count: bottle.count,
      price: bottle.price,
      purchaseUrl: bottle.purchaseUrl ?? "",
      purchasedAt: toDateInput(Date.now()),
    });
    setNewBottleQty(1);
    setAddingBottle(true);
  };

  const handleRemoveBottle = async (id: Id<"bottles">) => {
    if (!confirm("Remove this bottle? Its price drops from lifetime spend.")) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await removeBottle({ id });
      setEditingBottleId(null);
    } catch (err) {
      console.error("Failed to remove bottle:", err);
      setError("Failed to remove bottle");
    } finally {
      setSaving(false);
    }
  };

  const handleAddDosage = async () => {
    if (!addingDosageFor) return;
    setSaving(true);
    setError("");
    try {
      await createDosage({
        supplementId,
        personId: addingDosageFor,
        pillsPerWeek: newDosagePillsPerWeek,
      });
      setAddingDosageFor(null);
      setNewDosagePillsPerWeek(7);
    } catch (err) {
      console.error("Failed to add dosage:", err);
      setError("Failed to add dosage");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDosage = async (dosage: (typeof dosages)[number]) => {
    setSaving(true);
    try {
      if (group) {
        await setGroupDosage({
          groupId: group._id,
          personId: dosage.personId,
          pillsPerWeek: 0,
        });
      } else {
        await removeDosage({ id: dosage._id });
      }
      setEditingDosageId(null);
    } catch (err) {
      console.error("Failed to remove dosage:", err);
      setError("Failed to remove dosage");
    } finally {
      setSaving(false);
    }
  };

  const startEditDosage = (dosage: (typeof dosages)[number]) => {
    setEditingDosageId(dosage._id);
    setEditDosagePillsPerWeek(getDosageWeekly(dosage));
    setAddingDosageFor(null);
  };

  const handleSaveDosage = async (dosage: (typeof dosages)[number]) => {
    setSaving(true);
    setError("");
    try {
      if (group) {
        await setGroupDosage({
          groupId: group._id,
          personId: dosage.personId,
          pillsPerWeek: editDosagePillsPerWeek,
        });
      } else if (editDosagePillsPerWeek <= 0) {
        await removeDosage({ id: dosage._id });
      } else {
        await updateDosage({
          id: dosage._id,
          pillsPerWeek: editDosagePillsPerWeek,
        });
      }
      setEditingDosageId(null);
    } catch (err) {
      console.error("Failed to save dosage:", err);
      setError("Failed to save dosage");
    } finally {
      setSaving(false);
    }
  };

  const usersForThisSupplement = new Set(dosages.map((d) => d.personId));

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <Link
          href="/supplements"
          className="text-sm text-primary hover:underline"
        >
          ← Back to supplements
        </Link>
        <button
          onClick={handleDelete}
          disabled={saving}
          className="text-sm text-critical hover:text-critical/80 disabled:opacity-50"
        >
          Delete supplement
        </button>
      </div>

      {error && (
        <div className="bg-critical-light border border-critical/25 text-critical px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {group && (
        <div className="bg-primary-light border border-primary/25 rounded-lg px-4 py-3 text-sm flex items-center justify-between gap-3">
          <span>
            Part of the <strong>{group.name}</strong> group — on-hand is pooled
            across brands; forecast &amp; dosage are managed at the group level.
          </span>
          <Link
            href="/supplements"
            className="text-primary font-medium hover:underline whitespace-nowrap"
          >
            View group →
          </Link>
        </div>
      )}

      {/* Main Info Card */}
      <div className="card p-6 space-y-4">
        {supplement.imageUrl && (
          <div className="w-32 h-32 bg-surface-alt rounded-lg overflow-hidden border border-border-strong">
            <img
              src={supplement.imageUrl}
              alt={supplement.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isEditing ? (
              <div className="mb-2 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) =>
                      setEditData({ ...editData, name: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        findDetailsRef.current?.open();
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-border-strong rounded-lg font-bold text-lg"
                  />
                  <DsldFindDetails
                    ref={findDetailsRef}
                    initialQuery={editData.name}
                    onApply={applyDsldLabel}
                  />
                </div>
                {pendingDsldId && (
                  <div className="bg-primary-light border border-primary/30 rounded-lg px-3 py-2 text-xs flex items-center justify-between gap-2">
                    <span className="text-primary font-medium">
                      ✓ Will save DSLD #{pendingDsldId} facts & label on save
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingDsldId(null);
                        setPendingNutrients(null);
                      }}
                      className="text-text-muted hover:text-critical flex-shrink-0"
                    >
                      Unlink
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <h1 className="text-2xl font-bold mb-2">{supplement.name}</h1>
            )}

            {supplement.brand && (
              <p className="text-sm text-text-muted">
                {supplement.brand}
                {supplement.form && ` · ${supplement.form}`}
              </p>
            )}
          </div>

          <div
            className={`px-3 py-1 rounded-full text-sm font-semibold status-${status}`}
          >
            {status === "critical" && `${daysLeft} days`}
            {status === "low" && `${daysLeft} days`}
            {status === "on-track" && "On track"}
            {status === "stocked" && "Stocked"}
          </div>
        </div>

        <div className="border-t border-border-strong pt-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-text-label font-semibold">
                On hand
              </label>
              <div className="mt-2 text-lg font-mono font-bold">
                {ledger.onHand}
              </div>
              <div className="text-xs text-text-muted">
                {ledger.bottleCount}{" "}
                {ledger.bottleCount === 1 ? "bottle" : "bottles"}
                {openState &&
                  ledger.bottleCount > 1 &&
                  ` · open at ${ledger.openRemaining}/${openState.bottle.count}`}
                {ledger.incomingCount > 0 && (
                  <span> · +{ledger.incomingCount} incoming</span>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs text-text-label font-semibold">
                Runs out in
              </label>
              <div className="mt-2 text-lg font-bold">
                {isFinite(daysLeft) ? daysLeft : "—"}
              </div>
              <div className="text-xs text-text-muted">
                {isFinite(daysLeft)
                  ? `days · ${Math.round(rate * 10) / 10}/day`
                  : "no one taking it"}
              </div>
            </div>

            <div>
              <label className="text-xs text-text-label font-semibold">
                Monthly spend
              </label>
              <div className="mt-2 text-lg font-mono font-bold">
                {monthlySpend > 0 ? `$${monthlySpend.toFixed(2)}` : "—"}
              </div>
              <div className="text-xs text-text-muted">
                {ledger.openCostPerPill > 0
                  ? `$${ledger.openCostPerPill.toFixed(3)}/pill`
                  : "no price yet"}
              </div>
            </div>
          </div>
        </div>

        {/* Aggregated purchase links from all bottles */}
        {!isEditing && purchaseLinks.length > 0 && (
          <div className="border-t border-border-strong pt-4">
            <div className="text-xs text-text-label font-semibold mb-2">
              Buy again
            </div>
            <div className="flex flex-wrap gap-2">
              {purchaseLinks.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg border border-primary/40 text-primary hover:bg-primary-light/50 transition-colors"
                >
                  {storeLabel(url)} ↗
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Identity edit fields */}
        {isEditing && (
          <div className="border-t border-border-strong pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-text-label">
                  Brand
                </label>
                <input
                  type="text"
                  value={editData.brand}
                  onChange={(e) =>
                    setEditData({ ...editData, brand: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 border border-border-strong rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-label">
                  Form
                </label>
                <input
                  type="text"
                  value={editData.form}
                  onChange={(e) =>
                    setEditData({ ...editData, form: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 border border-border-strong rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-text-label">
                Serving size
              </label>
              <input
                type="text"
                value={editData.servingSize}
                onChange={(e) =>
                  setEditData({ ...editData, servingSize: e.target.value })
                }
                className="w-full mt-1 px-3 py-2 border border-border-strong rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-label">
                Default bottle size (pills)
              </label>
              <input
                type="number"
                min={1}
                value={editData.jarSize || ""}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    jarSize: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                className="w-32 mt-1 px-3 py-2 border border-border-strong rounded-lg font-mono text-sm"
              />
              <p className="text-xs text-text-muted mt-1">
                Just the default for new bottles. Edit stock in Bottles below.
              </p>
            </div>
            <ImageUploader
              imageUrl={editData.imageUrl}
              onImageChange={(url) =>
                setEditData({ ...editData, imageUrl: url })
              }
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="border-t border-border-strong pt-4 flex gap-2">
          {!isEditing ? (
            <button
              onClick={() => {
                setEditData({
                  name: supplement.name,
                  brand: supplement.brand || "",
                  form: supplement.form || "",
                  servingSize: supplement.servingSize || "",
                  category: supplement.category || "",
                  jarSize: supplement.jarSize,
                  imageUrl: supplement.imageUrl || "",
                });
                setPendingDsldId(null);
                setPendingNutrients(null);
                setIsEditing(true);
              }}
              className="btn-primary flex-1"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="btn-outline flex-1"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bottles (FIFO ledger) */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Bottles</h2>
          <div className="text-right">
            <div className="text-xs text-text-label font-semibold">
              Lifetime spent
            </div>
            <div className="font-mono font-bold">${lifetime.toFixed(2)}</div>
          </div>
        </div>

        {nonEmpty.length === 0 && incoming.length === 0 && empty.length === 0 && (
          <p className="text-sm text-text-muted">
            No bottles logged. Add one to start tracking stock & spend.
          </p>
        )}

        {/* Open + sealed spares */}
        <div className="space-y-2">
          {nonEmpty.map((s) => {
            const id = s.bottle._id as Id<"bottles">;
            const isEditingThis = editingBottleId === id;
            return (
              <div
                key={id}
                className="border border-border-strong rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      s.isOpen
                        ? "bg-primary text-white"
                        : "bg-surface-alt text-text-muted"
                    }`}
                  >
                    {s.isOpen ? "Open" : "Spare"}
                  </span>
                  <span className="font-mono text-sm">
                    {Math.round(s.remaining)} / {s.bottle.count}
                  </span>
                  <span className="font-mono text-sm">
                    ${s.bottle.price.toFixed(2)}
                  </span>
                  <span className="text-xs text-text-muted">
                    ${s.costPerPill.toFixed(3)}/pill
                  </span>
                  <span className="text-xs text-text-muted ml-auto">
                    {toDateInput(s.bottle.purchasedAt)}
                  </span>
                </div>
                <div className="h-1.5 bg-surface-alt rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/60"
                    style={{ width: `${Math.min(100, s.fillPct)}%` }}
                  />
                </div>
                {!isEditingThis ? (
                  <div className="flex gap-3 text-xs items-center">
                    {s.bottle.purchaseUrl && (
                      <a
                        href={s.bottle.purchaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {storeLabel(s.bottle.purchaseUrl)} ↗
                      </a>
                    )}
                    <button
                      onClick={() => {
                        setEditingBottleId(id);
                        setEditBottle({
                          count: s.bottle.count,
                          price: s.bottle.price,
                          purchaseUrl: s.bottle.purchaseUrl ?? "",
                          purchasedAt: toDateInput(s.bottle.purchasedAt),
                          remaining: Math.round(s.remaining),
                        });
                      }}
                      className="text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => duplicateBottle(s.bottle)}
                      className="text-primary hover:underline"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleRemoveBottle(id)}
                      disabled={saving}
                      className="text-critical hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <div className="border-t border-border-strong pt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-text-label font-semibold">
                        Price
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editBottle.price}
                          onChange={(e) =>
                            setEditBottle({
                              ...editBottle,
                              price: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full mt-1 px-2 py-1.5 border border-border-strong rounded-lg font-mono text-sm"
                        />
                      </label>
                      <label className="text-xs text-text-label font-semibold">
                        Count (capacity)
                        <input
                          type="number"
                          min="1"
                          value={editBottle.count || ""}
                          onChange={(e) =>
                            setEditBottle({
                              ...editBottle,
                              count: Math.max(0, parseInt(e.target.value) || 0),
                            })
                          }
                          className="w-full mt-1 px-2 py-1.5 border border-border-strong rounded-lg font-mono text-sm"
                        />
                      </label>
                      <label className="text-xs text-text-label font-semibold">
                        Available date
                        <input
                          type="date"
                          value={editBottle.purchasedAt}
                          onChange={(e) =>
                            setEditBottle({
                              ...editBottle,
                              purchasedAt: e.target.value,
                            })
                          }
                          className="w-full mt-1 px-2 py-1.5 border border-border-strong rounded-lg text-sm"
                        />
                        <p className="mt-1 text-[11px] font-normal text-text-muted">
                          Future dates are incoming and will not be used until then.
                        </p>
                      </label>
                      <label className="text-xs text-text-label font-semibold">
                        Pills remaining now
                        <input
                          type="number"
                          min="0"
                          max={editBottle.count || undefined}
                          value={editBottle.remaining}
                          onChange={(e) =>
                            setEditBottle({
                              ...editBottle,
                              remaining: Math.max(
                                0,
                                parseInt(e.target.value) || 0
                              ),
                            })
                          }
                          className="w-full mt-1 px-2 py-1.5 border border-border-strong rounded-lg font-mono text-sm"
                        />
                      </label>
                    </div>
                    <label className="text-xs text-text-label font-semibold block">
                      Purchase link
                      <input
                        type="url"
                        placeholder="https://store.com/product"
                        value={editBottle.purchaseUrl}
                        onChange={(e) =>
                          setEditBottle({
                            ...editBottle,
                            purchaseUrl: e.target.value,
                          })
                        }
                        className="w-full mt-1 px-2 py-1.5 border border-border-strong rounded-lg font-mono text-sm"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveBottle(id, s.remaining)}
                        disabled={saving}
                        className="btn-primary flex-1 text-sm py-1.5 disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingBottleId(null)}
                        className="btn-outline flex-1 text-sm py-1.5"
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

        {/* Incoming bottles */}
        {incoming.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-text-label uppercase tracking-wide">
              Incoming
            </p>
            {incoming.map((s) => {
              const id = s.bottle._id as Id<"bottles">;
              return (
                <div
                  key={id}
                  className="border border-primary/30 bg-primary-light rounded-lg p-3 flex items-center gap-3 text-sm"
                >
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary text-white">
                    Incoming
                  </span>
                  <span className="font-mono">
                    {Math.round(s.remaining)} / {s.bottle.count}
                  </span>
                  <span className="font-mono">
                    ${s.bottle.price.toFixed(2)}
                  </span>
                  <span className="text-xs text-text-muted">
                    available {toDateInput(s.bottle.purchasedAt)}
                  </span>
                  <button
                    onClick={() => {
                      setEditingBottleId(id);
                      setEditBottle({
                        count: s.bottle.count,
                        price: s.bottle.price,
                        purchaseUrl: s.bottle.purchaseUrl ?? "",
                        purchasedAt: toDateInput(s.bottle.purchasedAt),
                        remaining: Math.round(s.remaining),
                      });
                    }}
                    className="text-xs text-primary hover:underline ml-auto"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemoveBottle(id)}
                    disabled={saving}
                    className="text-xs text-critical hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Emptied history */}
        {empty.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-text-muted">
              Emptied ({empty.length}) · $
              {getLifetimeSpent(empty.map((s) => s.bottle)).toFixed(2)}
            </summary>
            <div className="mt-2 space-y-1">
              {empty.map((s) => {
                const id = s.bottle._id as Id<"bottles">;
                return (
                  <div
                    key={id}
                    className="flex items-center gap-3 text-xs text-text-muted px-1"
                  >
                    <span className="font-mono">{s.bottle.count} ct</span>
                    <span className="font-mono">
                      ${s.bottle.price.toFixed(2)}
                    </span>
                    <span>{toDateInput(s.bottle.purchasedAt)}</span>
                    <button
                      onClick={() => duplicateBottle(s.bottle)}
                      className="text-primary hover:underline ml-auto"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleRemoveBottle(id)}
                      disabled={saving}
                      className="text-critical hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {/* Add bottle */}
        <div className="border-t border-border-strong pt-4">
          {addingBottle ? (
            <div className="space-y-2">
              <BottleFields
                value={newBottle}
                onChange={setNewBottle}
                quantity={newBottleQty}
                onQuantityChange={setNewBottleQty}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddBottle}
                  disabled={saving}
                  className="btn-primary flex-1 text-sm py-1.5 disabled:opacity-50"
                >
                  {saving
                    ? "Adding..."
                    : newBottleQty > 1
                      ? `Add ${newBottleQty} bottles`
                      : "Add bottle"}
                </button>
                <button
                  onClick={() => setAddingBottle(false)}
                  className="btn-outline flex-1 text-sm py-1.5"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                setNewBottle({
                  count: supplement.jarSize,
                  price: 0,
                  purchaseUrl: "",
                  purchasedAt: toDateInput(Date.now()),
                });
                setNewBottleQty(1);
                setAddingBottle(true);
              }}
              className="w-full text-left px-3 py-2 border border-dashed border-primary/50 rounded-lg hover:bg-primary-light/50 transition-colors text-sm"
            >
              + Add bottle
            </button>
          )}
        </div>
      </div>

      {/* Supplement Facts — saved facts, or the DSLD/manual empty state */}
      <SupplementFactsPanel
        supplementId={supplementId}
        supplementName={supplement.name}
      />

      {/* Dosages Section */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-bold">Who takes this?</h2>

        {dosages.length > 0 ? (
          <div className="space-y-2">
            {dosages.map((dosage) => {
              const person = people.find((p) => p._id === dosage.personId);
              const paused = !dosage.personActive;
              const weekly = getDosageWeekly(dosage);
              const isEditingDosage = editingDosageId === dosage._id;
              return (
                <div
                  key={dosage._id}
                  className={`border border-border-strong rounded-lg p-3 ${
                    paused ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                    <div className="font-medium">
                      {person?.name}
                      {paused && (
                        <span className="text-xs text-text-muted font-normal">
                          {" "}
                          · paused (disabled)
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-text-muted">
                      {getDosageWeekly(dosage)} per week ·{" "}
                      {Math.round((weekly / 7) * 100) / 100}/day
                    </div>
                    </div>
                    {paused ? (
                      <span className="text-xs text-text-muted">
                        Re-enable in People
                      </span>
                    ) : (
                      <div className="flex items-center gap-3">
                        {!isEditingDosage && (
                          <button
                            onClick={() => startEditDosage(dosage)}
                            className="text-sm text-primary hover:underline"
                          >
                            Edit
                          </button>
                        )}
                          <button
                            onClick={() => handleRemoveDosage(dosage)}
                            disabled={saving}
                            className="text-sm text-critical hover:text-critical/80 disabled:opacity-50"
                          >
                            Remove
                          </button>
                      </div>
                    )}
                  </div>
                  {isEditingDosage && (
                    <div className="mt-3 space-y-3 border-t border-border-strong pt-3">
                      <DosageInput
                        value={editDosagePillsPerWeek}
                        onChange={setEditDosagePillsPerWeek}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveDosage(dosage)}
                          disabled={saving}
                          className="btn-primary flex-1 text-sm py-1.5 disabled:opacity-50"
                        >
                          {saving
                            ? "Saving..."
                            : editDosagePillsPerWeek <= 0
                              ? "Remove"
                              : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingDosageId(null)}
                          className="btn-outline flex-1 text-sm py-1.5"
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
        ) : (
          <p className="text-sm text-text-muted">No one assigned yet.</p>
        )}

        {/* Add Dosage — disabled for grouped brands (dosage lives on the group,
            so editing here would create an unintended per-brand override). */}
        {group ? (
          <div className="border-t border-border-strong pt-4 text-sm text-text-muted">
            Dosage for grouped brands is managed on the group.{" "}
            <Link href="/supplements" className="text-primary hover:underline">
              Manage group →
            </Link>
          </div>
        ) : (
        <div className="border-t border-border-strong pt-4">
          {addingDosageFor ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Add dosage for{" "}
                {people.find((p) => p._id === addingDosageFor)?.name}
              </p>
              <DosageInput
                value={newDosagePillsPerWeek}
                onChange={setNewDosagePillsPerWeek}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddDosage}
                  disabled={saving}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {saving ? "Adding..." : "Add dosage"}
                </button>
                <button
                  onClick={() => setAddingDosageFor(null)}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {people
                .filter(
                  (p) =>
                    p.status !== "disabled" &&
                    !usersForThisSupplement.has(p._id)
                )
                .map((person) => (
                  <button
                    key={person._id}
                    onClick={() => setAddingDosageFor(person._id)}
                    className="w-full text-left px-3 py-2 border border-dashed border-primary/50 rounded-lg hover:bg-primary-light/50 transition-colors text-sm"
                  >
                    + Add for {person.name}
                  </button>
                ))}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
