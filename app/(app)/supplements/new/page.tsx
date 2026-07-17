"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useHousehold } from "@/hooks/useHousehold";
import {
  DsldFindDetails,
  type DsldLabel,
  type DsldFindDetailsHandle,
} from "@/components/DsldFindDetails";
import { BottleFields, type BottleFieldsValue } from "@/components/BottleFields";
import { FactsView } from "@/components/FactsView";
import {
  FactsEditorModal,
  type FactsSavePayload,
} from "@/components/FactsEditorModal";
import { SupplementAppearancePicker } from "@/components/SupplementAppearancePicker";
import { WizardStepIndicator } from "@/components/add-supplement/WizardStepIndicator";
import { WizardFooter } from "@/components/add-supplement/WizardFooter";
import {
  BottleCard,
  SummaryRail,
} from "@/components/add-supplement/BottleCard";
import {
  GroupQuestionCard,
  type GroupChoice,
  type GroupSelectValue,
} from "@/components/add-supplement/GroupQuestionCard";
import { PersonDosageCard } from "@/components/add-supplement/PersonDosageCard";
import {
  emptyBottleDraft,
  fromDateInput,
  resolveJarSize,
} from "@/lib/add-supplement-utils";
import { suggestGroup } from "@/lib/group-suggest";
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

export default function AddSupplementPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[860px] pb-28">
          <h1 className="text-2xl font-bold tracking-tight">Add a supplement</h1>
          <p className="text-text-muted text-sm mt-1">Loading…</p>
        </div>
      }
    >
      <AddSupplementWizard />
    </Suspense>
  );
}

function AddSupplementWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryGroupId = searchParams.get("groupId") as Id<"groups"> | null;

  const householdId = useHousehold();
  const people = useQuery(
    api.people.list,
    householdId ? { householdId } : "skip"
  );
  const groups = useQuery(
    api.groups.list,
    householdId ? { householdId } : "skip"
  );

  const createSupplement = useMutation(api.supplements.create);
  const createDosage = useMutation(api.dosages.create);
  const importFacts = useAction(api.dsld.importFacts);
  const saveFacts = useMutation(api.supplementFacts.save);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [pendingLabel, setPendingLabel] = useState<DsldLabel | null>(null);
  const [manualFacts, setManualFacts] = useState<FactsSavePayload | null>(
    null
  );
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
    iconId: "" as string,
  });

  const [bottles, setBottles] = useState<BottleFieldsValue[]>([]);
  const [addingBottle, setAddingBottle] = useState(false);
  const [bottleDraft, setBottleDraft] = useState<BottleFieldsValue>(
    emptyBottleDraft(120)
  );
  const [bottleQty, setBottleQty] = useState(1);

  const [dosages, setDosages] = useState<DosageAssignment[]>([]);

  const [groupChoice, setGroupChoice] = useState<GroupChoice>("solo");
  const [selectedGroupId, setSelectedGroupId] =
    useState<GroupSelectValue | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [urlGroupApplied, setUrlGroupApplied] = useState(false);

  const findDetailsRef = useRef<DsldFindDetailsHandle>(null);

  const joinExisting =
    groupChoice === "group" &&
    selectedGroupId !== null &&
    selectedGroupId !== "new";
  const startingNewGroup =
    groupChoice === "group" && selectedGroupId === "new";
  const maxStep = joinExisting ? 2 : 3;

  const selectedGroup = groups?.find((g) => g._id === selectedGroupId);

  useEffect(() => {
    if (urlGroupApplied || !queryGroupId || !groups) return;
    const exists = groups.some((g) => g._id === queryGroupId);
    if (exists) {
      setGroupChoice("group");
      setSelectedGroupId(queryGroupId);
      setUrlGroupApplied(true);
    }
  }, [queryGroupId, groups, urlGroupApplied]);

  useEffect(() => {
    if (groupChoice === "group" && selectedGroupId === "new" && !newGroupName) {
      const base = formData.name.trim();
      if (base) setNewGroupName(base.split(/\s+/).slice(0, 3).join(" "));
    }
  }, [groupChoice, selectedGroupId, formData.name, newGroupName]);

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
    setBottles([...bottles, ...Array(bottleQty).fill(entry)]);
    if (!pendingLabel?.jarSizeSuggestion && bottles.length === 0) {
      setFormData((prev) => ({ ...prev, jarSize: entry.count }));
    }
    setAddingBottle(false);
    setBottleDraft(emptyBottleDraft(formData.jarSize));
    setBottleQty(1);
    setError("");
  }

  function validateStep1(): boolean {
    if (!formData.name.trim()) {
      setError("Supplement name is required");
      return false;
    }
    if (groupChoice === "group") {
      if (!selectedGroupId) {
        setError("Select a group or start a new one");
        return false;
      }
      if (selectedGroupId === "new" && !newGroupName.trim()) {
        setError("New group name is required");
        return false;
      }
    }
    setError("");
    return true;
  }

  function goToStep(next: number) {
    if (next < 1) return;
    if (next > maxStep) return;
    if (next > step && step === 1 && !validateStep1()) return;
    setStep(next);
    window.scrollTo(0, 0);
  }

  function handleContinue() {
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
      window.scrollTo(0, 0);
      return;
    }
    if (step === 2) {
      if (joinExisting) {
        void handleSave();
      } else {
        setStep(3);
        window.scrollTo(0, 0);
      }
      return;
    }
    void handleSave();
  }

  async function handleSave() {
    if (!householdId) {
      setError("Household not initialized");
      return;
    }
    if (!validateStep1()) {
      setStep(1);
      return;
    }

    const jarSize = resolveJarSize(
      pendingLabel?.jarSizeSuggestion,
      bottles,
      formData.jarSize
    );
    if (jarSize <= 0) {
      setError("Bottle size must be greater than 0");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const baseArgs = {
        householdId,
        name: formData.name.trim(),
        brand: formData.brand || undefined,
        form: formData.form || undefined,
        servingSize: formData.servingSize || undefined,
        category: formData.category || undefined,
        nutrients: formData.nutrients.length ? formData.nutrients : undefined,
        jarSize,
        imageUrl: formData.imageUrl || undefined,
        iconId: formData.iconId || undefined,
        bottles: bottles.map((b) => ({
          count: b.count,
          price: b.price,
          purchaseUrl: b.purchaseUrl || undefined,
          purchasedAt: fromDateInput(b.purchasedAt),
          remaining: Math.max(0, Math.min(b.remaining, b.count)),
        })),
      };

      let supplementId: Id<"supplements">;

      if (joinExisting && selectedGroupId && selectedGroupId !== "new") {
        supplementId = await createSupplement({
          ...baseArgs,
          groupId: selectedGroupId,
        });
      } else if (startingNewGroup) {
        supplementId = await createSupplement({
          ...baseArgs,
          newGroup: {
            name: newGroupName.trim(),
            category: formData.category || undefined,
            dosages,
          },
        });
      } else {
        supplementId = await createSupplement(baseArgs);
        for (const dosage of dosages) {
          await createDosage({
            supplementId,
            personId: dosage.personId,
            pillsPerWeek: dosage.pillsPerWeek,
          });
        }
      }

      if (pendingLabel) {
        try {
          await importFacts({
            supplementId,
            dsldId: pendingLabel.dsldId,
          });
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

  const activePeople =
    people?.filter((p) => p.status !== "disabled") ?? [];

  const dosageLines = joinExisting
    ? (selectedGroup?.takers ?? []).map((t) => ({
        _id: t.personId,
        name:
          activePeople.find((p) => p._id === t.personId)?.name ?? "Someone",
        pillsPerWeek: t.pillsPerWeek,
      }))
    : dosages.map((d) => ({
        _id: d.personId,
        name:
          activePeople.find((p) => p._id === d.personId)?.name ?? "Someone",
        pillsPerWeek: d.pillsPerWeek,
      }));

  const railGroupName = joinExisting
    ? selectedGroup?.name
    : startingNewGroup
      ? newGroupName.trim() || formData.name.trim()
      : undefined;

  return (
    <div className="max-w-[860px] pb-28">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add a supplement</h1>
          <p className="text-text-muted text-sm mt-1">
            A <b className="text-text font-semibold">supplement</b> is one
            product you take. The{" "}
            <b className="text-text font-semibold">bottles</b> are the physical
            jars of it you own.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/supplements")}
          className="text-sm text-text-muted hover:text-text flex-shrink-0 mt-1"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="bg-critical-light border border-critical/25 text-critical px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      <WizardStepIndicator
        current={step}
        maxStep={maxStep}
        onGoTo={goToStep}
      />

      <form
        onSubmit={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          const target = e.target as HTMLElement;
          if (
            e.key === "Enter" &&
            target.tagName !== "BUTTON" &&
            target.tagName !== "TEXTAREA"
          ) {
            e.preventDefault();
          }
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_250px] gap-6 items-start">
          <div>
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-text-label block mb-1">
                    Search or name the supplement
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint text-sm pointer-events-none">
                      ⌕
                    </span>
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
                      className="w-full pl-9 pr-3 py-3 border border-border-strong rounded-lg text-[15px] font-medium"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <DsldFindDetails
                      ref={findDetailsRef}
                      initialQuery={formData.name}
                      onApply={applyDsldLabel}
                      buttonLabel="Find in DSLD"
                      onManualEntry={() => setFactsEditorOpen(true)}
                    />
                    {!pendingLabel && !manualFacts && (
                      <button
                        type="button"
                        onClick={() => setFactsEditorOpen(true)}
                        className="text-sm text-primary font-semibold hover:underline"
                      >
                        Enter the label facts manually
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-text-label block mb-1">
                      Brand
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Thorne"
                      value={formData.brand}
                      onChange={(e) =>
                        setFormData({ ...formData, brand: e.target.value })
                      }
                      className="w-full px-3 py-2.5 border border-border-strong rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-label block mb-1">
                      Form
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Softgel"
                      value={formData.form}
                      onChange={(e) =>
                        setFormData({ ...formData, form: e.target.value })
                      }
                      className="w-full px-3 py-2.5 border border-border-strong rounded-lg text-sm"
                    />
                  </div>
                </div>

                <SupplementAppearancePicker
                  iconId={formData.iconId || undefined}
                  imageUrl={formData.imageUrl || undefined}
                  name={formData.name || "Supplement"}
                  onChange={({ iconId, imageUrl }) =>
                    setFormData({
                      ...formData,
                      iconId: iconId ?? "",
                      imageUrl: imageUrl ?? "",
                    })
                  }
                />

                <GroupQuestionCard
                  choice={groupChoice}
                  onChoiceChange={(c) => {
                    setGroupChoice(c);
                    if (c === "solo") {
                      setSelectedGroupId(null);
                      return;
                    }
                    if (selectedGroupId) return;
                    if (
                      queryGroupId &&
                      groups?.some((g) => g._id === queryGroupId)
                    ) {
                      setSelectedGroupId(queryGroupId);
                      return;
                    }
                    const suggested = groups?.length
                      ? suggestGroup(
                          formData.name,
                          groups.map((g) => ({
                            _id: g._id,
                            name: g.name,
                            members: g.members.map((m) => ({
                              name: m.supplement.name,
                              brand: m.supplement.brand,
                            })),
                          }))
                        )
                      : null;
                    if (suggested) {
                      setSelectedGroupId(suggested._id as Id<"groups">);
                    } else if (!groups?.length) {
                      setSelectedGroupId("new");
                    }
                  }}
                  groups={groups ?? []}
                  people={activePeople}
                  selectedGroupId={selectedGroupId}
                  onSelectGroup={setSelectedGroupId}
                  newGroupName={newGroupName}
                  onNewGroupNameChange={setNewGroupName}
                  supplementName={formData.name}
                  suggestedGroupId={queryGroupId}
                />

                {/* DSLD / manual facts sit at the bottom so identity fields stay primary. */}
                {(pendingLabel || manualFacts) && (
                  <div className="space-y-3 pt-2 border-t border-border-strong">
                    <h3 className="text-sm font-bold">Label details</h3>

                    {pendingLabel && (
                      <div className="bg-primary-light border border-primary/30 rounded-lg px-3.5 py-2.5 text-sm flex items-start gap-2.5">
                        <span className="text-base">🏷️</span>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-primary">
                            Label linked.
                          </span>{" "}
                          <span className="text-text-muted">
                            Brand, form, serving size and the full Supplement
                            Facts panel were filled in from the NIH database
                            (DSLD #{pendingLabel.dsldId}).
                          </span>
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
                      <div className="bg-primary-light border border-primary/30 rounded-lg px-3.5 py-2.5 text-sm flex items-start justify-between gap-3">
                        <span className="font-semibold text-primary">
                          ✓ Facts entered manually — will be saved with the
                          supplement.
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

                    <div className="border border-border-strong rounded-lg p-4 max-h-80 overflow-auto bg-surface">
                      <h4 className="text-sm font-semibold mb-3">
                        Supplement Facts preview
                      </h4>
                      <FactsView
                        facts={
                          pendingLabel
                            ? {
                                servingSize: pendingLabel.servingSize,
                                servingsPerContainer:
                                  pendingLabel.servingsPerContainer,
                                rows: pendingLabel.rows,
                                otherIngredients:
                                  pendingLabel.otherIngredients,
                                offMarket: pendingLabel.offMarket,
                                thumbnailUrl: pendingLabel.thumbnailUrl,
                                dsldId: pendingLabel.dsldId,
                              }
                            : manualFacts!
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div>
                <h3 className="text-[15px] font-bold mb-1">
                  Bottles of {formData.name.trim() || "this supplement"} you
                  own
                </h3>
                <p className="text-[13px] text-text-muted mb-3.5">
                  Each card is one physical jar. Refill drains the oldest first
                  and forecasts when you&apos;ll run out.
                </p>

                <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
                  {bottles.map((b, idx) => (
                    <BottleCard
                      key={idx}
                      bottle={b}
                      onRemove={() =>
                        setBottles(bottles.filter((_, i) => i !== idx))
                      }
                    />
                  ))}

                  {addingBottle ? (
                    <div className="col-span-full border border-border-strong rounded-xl p-4 bg-surface space-y-3">
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
                          className="btn-primary flex-1 text-sm"
                        >
                          {bottleQty > 1
                            ? `Add ${bottleQty} bottles`
                            : "Add bottle"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelNewBottle}
                          className="btn-outline flex-1 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                      {bottles.length > 0 && (
                        <p className="text-xs text-text-muted">
                          Or{" "}
                          <button
                            type="button"
                            className="text-primary font-semibold hover:underline"
                            onClick={() => openNewBottle({ ...bottles[0] })}
                          >
                            duplicate an existing bottle
                          </button>
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openNewBottle()}
                      className="border-[1.5px] border-dashed border-border-strong rounded-xl min-h-[148px] flex flex-col items-center justify-center gap-1.5 text-text-muted font-semibold text-[13.5px] hover:border-primary hover:text-primary hover:bg-primary-light transition-colors"
                    >
                      <span className="text-[22px] leading-none">＋</span>
                      Add a bottle
                      {bottles.length > 0 && (
                        <span className="font-normal text-xs text-text-faint">
                          or duplicate an existing one
                        </span>
                      )}
                    </button>
                  )}
                </div>

                <div className="flex gap-2.5 items-start text-[13px] text-text-muted bg-surface-alt border border-border rounded-lg px-3.5 py-2.5 mt-4">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-light text-primary font-bold text-xs flex items-center justify-center mt-0.5">
                    i
                  </span>
                  <span>
                    No bottles yet? That&apos;s fine — save without any and add
                    them when your order arrives. The supplement will show as{" "}
                    <b className="text-text font-semibold">out of stock</b> until
                    then.
                  </span>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h3 className="text-[15px] font-bold mb-1">Who takes it?</h3>
                <p className="text-[13px] text-text-muted mb-3.5">
                  Turn on each person who takes this, then set how often. Dosage
                  drives the run-out forecast.
                </p>
                {!people ? (
                  <p className="text-sm text-text-muted">Loading people…</p>
                ) : activePeople.length === 0 ? (
                  <div className="border border-dashed border-border-strong rounded-xl p-4 space-y-2">
                    <p className="text-sm text-text-muted">
                      No people in this household yet. Add someone under People,
                      then come back to assign a dosage.
                    </p>
                    <Link
                      href="/people"
                      className="inline-flex text-sm font-semibold text-primary hover:underline"
                    >
                      Go to People →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activePeople.map((person) => {
                      const personDosage = dosages.find(
                        (d) => d.personId === person._id
                      );
                      return (
                        <PersonDosageCard
                          key={person._id}
                          person={person}
                          active={!!personDosage}
                          pillsPerWeek={personDosage?.pillsPerWeek ?? 7}
                          onToggle={(on) => {
                            if (on) {
                              setDosages([
                                ...dosages,
                                { personId: person._id, pillsPerWeek: 7 },
                              ]);
                            } else {
                              setDosages(
                                dosages.filter(
                                  (d) => d.personId !== person._id
                                )
                              );
                            }
                          }}
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
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <SummaryRail
            supplementName={formData.name}
            imageUrl={
              formData.iconId
                ? undefined
                : formData.imageUrl || pendingLabel?.thumbnailUrl
            }
            iconId={formData.iconId || undefined}
            bottles={bottles}
            groupMode={groupChoice}
            groupName={railGroupName}
            memberCount={selectedGroup?.members.length}
            joinExisting={!!joinExisting}
            dosageLines={dosageLines}
            dosageFromGroup={!!joinExisting}
          />
        </div>
      </form>

      <WizardFooter
        step={step}
        maxStep={maxStep}
        saving={saving}
        onBack={() => goToStep(step - 1)}
        onContinue={handleContinue}
      />

      {factsEditorOpen && (
        <FactsEditorModal
          initial={manualFacts}
          onSave={(payload) => {
            setManualFacts(payload);
            setPendingLabel(null);
          }}
          onClose={() => setFactsEditorOpen(false)}
        />
      )}
    </div>
  );
}
