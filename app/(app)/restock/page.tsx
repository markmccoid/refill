"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { useHousehold } from "@/hooks/useHousehold";
import { getRunOutDate } from "@/lib/supplement-utils";
import { RestockPickerModal } from "@/components/restock/RestockPickerModal";
import { RetailerDialog } from "@/components/restock/RetailerDialog";
import { CandidateDrawer } from "@/components/restock/CandidateDrawer";
import {
  PurchaseDialog,
  PurchaseLineInput,
} from "@/components/restock/PurchaseDialog";
import { retailerAccent } from "@/lib/retailer-accent";
import { Id } from "@/convex/_generated/dataModel";

type PlanData = FunctionReturnType<typeof api.restock.plan>;
type PlanItem = PlanData["items"][number];
type PlanBasket = PlanData["baskets"][number];
type Retailer = PlanData["retailers"][number];

const money = (n: number) => `$${n.toFixed(2)}`;
const perPill = (n: number) =>
  n >= 1 ? `$${n.toFixed(2)}` : `${(n * 100).toFixed(1)}¢`;

export default function RestockPage() {
  const householdId = useHousehold();
  const plan = useQuery(
    api.restock.plan,
    householdId ? { householdId } : "skip"
  );

  const [showPicker, setShowPicker] = useState(false);
  const [retailerDialog, setRetailerDialog] = useState<
    { retailer: Retailer | null } | null
  >(null);
  const [purchaseFor, setPurchaseFor] = useState<Retailer | null>(null);

  const updateSettings = useMutation(api.households.updateSettings);
  const removeItem = useMutation(api.restock.removeItem);

  if (!householdId || !plan) {
    return <div className="text-center py-12">Loading restock plan...</div>;
  }

  const unassigned = plan.items.filter(
    (i) => i.selectedCandidateId === null
  ).length;
  const cheapestBaskets = plan.baskets.filter((b) => b.cheapest);

  const purchaseLines: PurchaseLineInput[] = purchaseFor
    ? (plan.baskets.find((b) => b.retailerId === purchaseFor._id)?.lines ?? []).map(
        (line) => {
          const planItem = plan.items.find((i) => i._id === line.itemId);
          return {
            itemId: line.itemId,
            itemName: line.itemName,
            brandName: line.candidateLabel,
            defaultQty: line.qty,
            defaultPrice: line.unitPrice,
            defaultCount:
              planItem?.candidates.find((c) => c._id === line.candidateId)
                ?.count ?? 1,
            destination: {
              kind: "existing" as const,
              supplementId: planItem!.defaultDestinationSupplementId,
            },
          };
        }
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Restock</h1>
          <p className="text-text-muted text-sm mt-1">
            Pick what to buy, check prices, and group orders by retailer.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRetailerDialog({ retailer: null })}
            className="px-4 py-2 text-sm font-medium border border-border-strong rounded-lg hover:bg-text/5"
          >
            + Retailer
          </button>
          <button
            onClick={() => setShowPicker(true)}
            className="px-4 py-2 text-sm font-semibold bg-primary hover:bg-primary-dark text-white rounded-lg"
          >
            Choose supplements
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm text-text-muted bg-surface-alt border border-border rounded-lg px-4 py-2.5">
        <SettingsKnob
          label="Flag items running out within"
          suffix="days"
          value={plan.forecastWindowDays}
          onCommit={(v) =>
            updateSettings({ householdId, forecastWindowDays: v })
          }
        />
        <SettingsKnob
          label="Buy enough to last"
          suffix="days"
          value={plan.coverageTargetDays}
          onCommit={(v) =>
            updateSettings({ householdId, coverageTargetDays: v })
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3 items-start">
        <div className="xl:col-span-2 space-y-4">
          {plan.items.length === 0 ? (
            <div className="border border-dashed border-border-strong rounded-xl p-10 text-center text-sm text-text-muted">
              Your restock plan is empty.
              <br />
              <button
                onClick={() => setShowPicker(true)}
                className="mt-3 text-primary font-semibold hover:underline"
              >
                Choose supplements to restock
              </button>
            </div>
          ) : (
            plan.items.map((item) => (
              <ItemCard
                key={item._id}
                householdId={householdId}
                item={item}
                hasRetailers={plan.retailers.length > 0}
                onAddRetailer={() => setRetailerDialog({ retailer: null })}
                onRemove={() => {
                  const hasWork =
                    item.enteredPrice !== null ||
                    item.selectedCandidateId !== null;
                  if (
                    !hasWork ||
                    window.confirm(
                      `Remove ${item.name} from the plan? Entered prices will be discarded.`
                    )
                  ) {
                    removeItem({ id: item._id });
                  }
                }}
              />
            ))
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-muted">
            Retailer baskets
          </h2>
          {cheapestBaskets.length >= 2 && (
            <p className="text-xs text-primary font-semibold bg-primary-light/40 border border-primary/20 rounded-lg px-3 py-2">
              Cheapest all-in:{" "}
              {cheapestBaskets.map((b) => b.retailerName).join(" · ")}
            </p>
          )}
          {plan.baskets.length === 0 ? (
            <div className="border border-dashed border-border-strong rounded-xl p-6 text-center text-xs text-text-muted">
              Select a retailer option on an item to start a basket.
            </div>
          ) : (
            plan.baskets.map((basket) => {
              const retailer =
                plan.retailers.find((r) => r._id === basket.retailerId) ?? null;
              if (!retailer) return null;
              return (
                <BasketCard
                  key={basket.retailerId}
                  basket={basket}
                  onEdit={() => setRetailerDialog({ retailer })}
                  onPurchase={() => setPurchaseFor(retailer)}
                />
              );
            })
          )}
          {unassigned > 0 && (
            <p className="text-xs text-text-muted">
              {unassigned} item{unassigned === 1 ? "" : "s"} without a candidate
              selected yet.
            </p>
          )}
        </aside>
      </div>

      {showPicker && (
        <RestockPickerModal
          householdId={householdId}
          onClose={() => setShowPicker(false)}
        />
      )}
      {retailerDialog && (
        <RetailerDialog
          householdId={householdId}
          retailer={retailerDialog.retailer}
          onClose={() => setRetailerDialog(null)}
        />
      )}
      {purchaseFor && (
        <PurchaseDialog
          retailerId={purchaseFor._id}
          retailerName={purchaseFor.name}
          lines={purchaseLines}
          onClose={() => setPurchaseFor(null)}
        />
      )}
    </div>
  );
}

function SettingsKnob({
  label,
  suffix,
  value,
  onCommit,
}: {
  label: string;
  suffix: string;
  value: number;
  onCommit: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      {label}
      <input
        key={value}
        type="number"
        min="1"
        defaultValue={value}
        onBlur={(e) => {
          const v = parseInt(e.target.value, 10);
          if (Number.isFinite(v) && v > 0 && v !== value) onCommit(v);
        }}
        className="w-16 px-2 py-1 text-sm border border-border-strong rounded-md bg-surface text-text text-center"
      />
      {suffix}
    </label>
  );
}

function ItemCard({
  householdId,
  item,
  hasRetailers,
  onAddRetailer,
  onRemove,
}: {
  householdId: Id<"households">;
  item: PlanItem;
  hasRetailers: boolean;
  onAddRetailer: () => void;
  onRemove: () => void;
}) {
  const setQty = useMutation(api.restock.setQty);
  const setPrice = useMutation(api.restock.setPrice);
  const selectCandidate = useMutation(api.restock.selectCandidate);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isGroup = item.subjectKind === "group";
  const selected =
    item.candidates.find((c) => c._id === item.selectedCandidateId) ?? null;
  const selectedAccent = selected ? retailerAccent(selected.retailerId) : null;
  const lowestIds = new Set(item.lowestPerPillCandidateIds);
  const subjectId = (item.groupId ?? item.supplementId) as
    | Id<"supplements">
    | Id<"groups">;

  const runOut =
    item.daysLeft === null
      ? null
      : getRunOutDate(item.daysLeft).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

  return (
    <article className="bg-surface border border-border-strong rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold">{item.name}</h3>
            {isGroup && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-primary-light text-primary px-1.5 py-0.5 rounded">
                Group
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            {Math.round(item.onHand)} available
            {item.incomingCount > 0 && (
              <> + {Math.round(item.incomingCount)} incoming</>
            )}{" "}
            ·{" "}
            {item.daysLeft === null ? (
              "no forecast"
            ) : (
              <>
                runs out {runOut}{" "}
                <span
                  className={
                    item.daysLeft <= 7 ? "text-red-600 font-semibold" : ""
                  }
                >
                  ({item.daysLeft <= 0 ? "out now" : `${item.daysLeft}d`})
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-text-muted">
            Bottles
            <input
              key={`${item._id}-${item.qty}`}
              type="number"
              min="1"
              defaultValue={item.qty}
              onBlur={(e) => {
                const v = parseInt(e.target.value, 10);
                if (Number.isFinite(v) && v >= 1 && v !== item.qty)
                  setQty({ id: item._id, qty: v });
              }}
              className="w-14 px-2 py-1 text-sm border border-border-strong rounded-md bg-surface text-text text-center"
            />
            <span title="Enough to cover your coverage target">
              (suggested {item.recommendedQty})
            </span>
          </label>
          <button
            onClick={onRemove}
            title="Remove from plan"
            className="text-text-muted hover:text-red-600 text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {!hasRetailers ? (
        <div className="border border-dashed border-border-strong rounded-lg p-4 text-center text-xs text-text-muted">
          Add a retailer to start comparing candidates.{" "}
          <button
            onClick={onAddRetailer}
            className="text-primary font-semibold hover:underline"
          >
            + Add retailer
          </button>
        </div>
      ) : item.candidates.length === 0 ? (
        <div className="border border-dashed border-border-strong rounded-lg p-4 text-center text-xs text-text-muted space-y-2">
          <p>No candidate products yet for this subject.</p>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="text-primary font-semibold hover:underline"
          >
            Manage options
          </button>
        </div>
      ) : (
        <>
          {selected && selectedAccent ? (
            <div
              className={`rounded-lg border border-l-4 px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 ${selectedAccent.selectedRow}`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{selected.label}</p>
                <p className="text-xs text-text-muted">
                  {selected.retailerName}
                </p>
              </div>
              <a
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-primary hover:underline shrink-0"
              >
                Check Site ↗
              </a>
              <input
                key={`${item._id}-${item.enteredPrice}`}
                type="number"
                min={0}
                step={0.01}
                placeholder="Price"
                defaultValue={item.enteredPrice ?? ""}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  const v = raw === "" ? null : parseFloat(raw);
                  const next =
                    v !== null && Number.isFinite(v) && v >= 0 ? v : null;
                  if (next !== item.enteredPrice) {
                    setPrice({ id: item._id, price: next });
                  }
                }}
                className="w-20 px-2 py-1 text-sm border border-border-strong rounded-md bg-surface text-right"
              />
              {selected.count !== null &&
                selected.count > 0 &&
                item.enteredPrice !== null && (
                  <span className="text-xs font-semibold whitespace-nowrap">
                    {perPill(item.enteredPrice / selected.count)}/pill
                  </span>
                )}
            </div>
          ) : (
            <p className="text-xs text-text-muted border border-dashed border-border-strong rounded-lg p-3 text-center">
              Select a retailer option below
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {item.candidates.map((c) => {
              const isSelected = item.selectedCandidateId === c._id;
              const accent = retailerAccent(c.retailerId);
              const showChipPerPill =
                isSelected &&
                item.enteredPrice !== null &&
                c.count !== null &&
                c.count > 0;
              return (
                <button
                  key={c._id}
                  type="button"
                  onClick={() =>
                    selectCandidate({
                      id: item._id,
                      candidateId: isSelected ? null : c._id,
                    })
                  }
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    isSelected
                      ? accent.chipSelected
                      : "border-border text-text-muted hover:border-text-muted"
                  }`}
                >
                  {c.retailerName}
                  {showChipPerPill
                    ? ` · ${perPill(item.enteredPrice! / c.count!)}`
                    : ""}
                  {lowestIds.has(c._id) && (
                    <span
                      className="ml-1 text-primary"
                      title="Lowest $/pill among priced options"
                    >
                      ★
                    </span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="text-[11px] text-primary font-semibold px-1"
            >
              Manage options
            </button>
          </div>
        </>
      )}

      {subjectId && (
        <CandidateDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          householdId={householdId}
          subjectKind={item.subjectKind}
          subjectId={subjectId}
          subjectName={item.name}
          openedFrom="restock"
        />
      )}
    </article>
  );
}

function BasketCard({
  basket,
  onEdit,
  onPurchase,
}: {
  basket: PlanBasket;
  onEdit: () => void;
  onPurchase: () => void;
}) {
  const accent = retailerAccent(basket.retailerId);
  const missingPrices = basket.lines.filter(
    (l) => l.lineTotal === null
  ).length;

  return (
    <div
      className={`bg-surface border border-border-strong border-l-4 rounded-xl p-4 space-y-3 ${accent.basketBorder} ${
        basket.cheapest ? `ring-2 ${accent.basketRing}` : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-sm">{basket.retailerName}</h3>
        <div className="flex items-center gap-2">
          {basket.cheapest && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary-light px-1.5 py-0.5 rounded">
              Cheapest all-in
            </span>
          )}
          <button
            onClick={onEdit}
            title="Edit retailer"
            className="text-text-muted hover:text-text text-xs"
          >
            ✎
          </button>
        </div>
      </div>

      <ul className="space-y-1.5">
        {basket.lines.map((line) => (
          <li key={line.itemId} className="flex justify-between gap-2 text-xs">
            <span className="truncate">
              {line.itemName}
              {line.candidateLabel !== line.itemName && (
                <span className="text-text-muted">
                  {" "}
                  ({line.candidateLabel})
                </span>
              )}{" "}
              × {line.qty}
            </span>
            <span className="whitespace-nowrap font-medium">
              {line.lineTotal !== null ? money(line.lineTotal) : "no price"}
            </span>
          </li>
        ))}
      </ul>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-text-muted">Subtotal</span>
          <span className="font-medium">{money(basket.subtotal)}</span>
        </div>
        {basket.appliedShipping !== null && (
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Shipping</span>
            <span>
              {basket.appliedShipping === 0
                ? "Free"
                : money(basket.appliedShipping)}
            </span>
          </div>
        )}
        {basket.shippingUnknown && (
          <p className="text-[11px] text-amber-700 font-medium">
            Shipping cost unknown
          </p>
        )}
        {basket.allIn !== null && (
          <div className="flex justify-between font-bold border-t border-border pt-1.5">
            <span>All-in</span>
            <span>{money(basket.allIn)}</span>
          </div>
        )}
        {!basket.complete && (
          <p className="text-[11px] text-text-muted">
            Incomplete — missing price(s)
          </p>
        )}
      </div>

      {basket.thresholdUnset ? (
        <button
          onClick={onEdit}
          className="text-[11px] text-text-muted hover:text-primary"
        >
          Free-shipping threshold not set — add one
        </button>
      ) : basket.gapToFreeShipping !== null && basket.gapToFreeShipping > 0 ? (
        <div>
          <p className="text-[11px] text-low font-semibold">
            {money(basket.gapToFreeShipping)} to free shipping (
            {money(basket.freeShippingThreshold!)})
          </p>
          <div className="mt-1 h-1.5 bg-text/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-low rounded-full"
              style={{
                width: `${Math.min(
                  100,
                  (basket.subtotal / basket.freeShippingThreshold!) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      ) : basket.freeShippingMet ? (
        <p className="text-[11px] text-primary font-semibold">
          ✓ Free shipping met ({money(basket.freeShippingThreshold!)})
        </p>
      ) : null}

      {missingPrices > 0 && (
        <p className="text-[11px] text-text-muted">
          {missingPrices} item{missingPrices === 1 ? "" : "s"} missing a price
          — subtotal is incomplete.
        </p>
      )}

      <button
        onClick={onPurchase}
        className="w-full px-3 py-2 text-sm font-semibold bg-primary hover:bg-primary-dark text-white rounded-lg"
      >
        Mark as Purchased
      </button>
    </div>
  );
}
