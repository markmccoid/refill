"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { useHousehold } from "@/hooks/useHousehold";
import { getRunOutDate } from "@/lib/supplement-utils";
import { RestockPickerModal } from "@/components/restock/RestockPickerModal";
import { RetailerDialog } from "@/components/restock/RetailerDialog";
import {
  PurchaseDialog,
  PurchaseLineInput,
} from "@/components/restock/PurchaseDialog";

type PlanData = FunctionReturnType<typeof api.restock.plan>;
type PlanItem = PlanData["items"][number];
type Offer = PlanItem["offers"][number];
type Retailer = PlanData["retailers"][number];

const money = (n: number) => `$${n.toFixed(2)}`;
// Cost per pill: sub-dollar amounts read better in cents ("8.3¢" vs "$0.08").
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

  // Retailer orders are derived, never stored (ADR-0006): group items by their
  // selected offer. An item whose selection no longer resolves to an offer
  // (e.g. the brand left its group) counts as unselected.
  const orders = new Map<string, { item: PlanItem; offer: Offer }[]>();
  for (const item of plan.items) {
    const offer = item.offers.find((o) => o.selected);
    if (!offer) continue;
    const lines = orders.get(offer.retailerId) ?? [];
    lines.push({ item, offer });
    orders.set(offer.retailerId, lines);
  }
  const unassigned = plan.items.filter(
    (i) => !i.offers.some((o) => o.selected)
  ).length;

  const purchaseLines: PurchaseLineInput[] = purchaseFor
    ? (orders.get(purchaseFor._id) ?? []).map(({ item, offer }) => ({
        itemId: item._id,
        itemName: item.name,
        brandName: offer.brandName,
        defaultQty: item.qty,
        defaultPrice: offer.enteredPrice ?? offer.avgPrice,
        defaultCount: offer.jarSize,
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
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
            className="px-4 py-2 text-sm font-medium border border-black/15 rounded-lg hover:bg-black/5"
          >
            + Retailer
          </button>
          <button
            onClick={() => setShowPicker(true)}
            className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
          >
            Choose supplements
          </button>
        </div>
      </div>

      {/* Settings knobs (ADR-0006): urgency window + coverage target */}
      <div className="flex items-center gap-6 text-sm text-text-muted bg-surface-alt border border-black/7 rounded-lg px-4 py-2.5">
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
        {/* Plan items */}
        <div className="xl:col-span-2 space-y-4">
          {plan.items.length === 0 ? (
            <div className="border border-dashed border-black/15 rounded-xl p-10 text-center text-sm text-text-muted">
              Your restock plan is empty.
              <br />
              <button
                onClick={() => setShowPicker(true)}
                className="mt-3 text-emerald-700 font-semibold hover:underline"
              >
                Choose supplements to restock
              </button>
            </div>
          ) : (
            plan.items.map((item) => (
              <ItemCard
                key={item._id}
                item={item}
                hasRetailers={plan.retailers.length > 0}
                onAddRetailer={() => setRetailerDialog({ retailer: null })}
                onRemove={() => {
                  const hasWork =
                    item.offers.some((o) => o.enteredPrice !== null) ||
                    item.offers.some((o) => o.selected);
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

        {/* Order totals — derived grouping of selections by retailer */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-muted">
            Order totals
          </h2>
          {orders.size === 0 ? (
            <div className="border border-dashed border-black/15 rounded-xl p-6 text-center text-xs text-text-muted">
              Select a retailer on an item to start an order.
            </div>
          ) : (
            plan.retailers
              .filter((r) => orders.has(r._id))
              .map((r) => (
                <OrderCard
                  key={r._id}
                  retailer={r}
                  lines={orders.get(r._id)!}
                  onEdit={() => setRetailerDialog({ retailer: r })}
                  onPurchase={() => setPurchaseFor(r)}
                />
              ))
          )}
          {unassigned > 0 && (
            <p className="text-xs text-text-muted">
              {unassigned} item{unassigned === 1 ? "" : "s"} without a retailer
              selected yet.
            </p>
          )}
        </div>
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
        className="w-16 px-2 py-1 text-sm border border-black/15 rounded-md bg-surface text-text text-center"
      />
      {suffix}
    </label>
  );
}

function ItemCard({
  item,
  hasRetailers,
  onAddRetailer,
  onRemove,
}: {
  item: PlanItem;
  hasRetailers: boolean;
  onAddRetailer: () => void;
  onRemove: () => void;
}) {
  const setQty = useMutation(api.restock.setQty);
  const isGroup = item.subjectKind === "group";
  const runOut =
    item.daysLeft === null
      ? null
      : getRunOutDate(item.daysLeft).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

  return (
    <div className="bg-surface border border-black/10 rounded-xl p-5 space-y-4">
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
            {Math.round(item.onHand)} on hand ·{" "}
            {!isGroup && item.defaultJarSize > 0 && (
              <>{item.defaultJarSize}-ct bottles · </>
            )}
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
              className="w-14 px-2 py-1 text-sm border border-black/15 rounded-md bg-surface text-text text-center"
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
        <div className="border border-dashed border-black/15 rounded-lg p-4 text-center text-xs text-text-muted">
          Add a retailer to start comparing prices.{" "}
          <button
            onClick={onAddRetailer}
            className="text-emerald-700 font-semibold hover:underline"
          >
            + Add retailer
          </button>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-text-muted text-left">
              {isGroup && <th className="pb-1.5 font-semibold">Brand</th>}
              <th className="pb-1.5 font-semibold">Retailer</th>
              <th className="pb-1.5 font-semibold">Link</th>
              <th className="pb-1.5 font-semibold text-right">Avg</th>
              <th className="pb-1.5 font-semibold text-right">Price</th>
              <th className="pb-1.5 font-semibold text-right">$ / pill</th>
              <th className="pb-1.5 font-semibold text-center">Buy here</th>
            </tr>
          </thead>
          <tbody>
            {item.offers.map((offer) => (
              <OfferRow
                key={`${offer.supplementId}-${offer.retailerId}`}
                item={item}
                offer={offer}
                showBrand={isGroup}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function OfferRow({
  item,
  offer,
  showBrand,
}: {
  item: PlanItem;
  offer: Offer;
  showBrand: boolean;
}) {
  const setPrice = useMutation(api.restock.setPrice);
  const selectOffer = useMutation(api.restock.selectOffer);
  const upsertLink = useMutation(api.savedLinks.upsert);
  const [editingLink, setEditingLink] = useState(false);

  const commitLink = (url: string) => {
    setEditingLink(false);
    if (url.trim() !== (offer.url ?? "")) {
      upsertLink({
        supplementId: offer.supplementId,
        retailerId: offer.retailerId,
        url,
      });
    }
  };

  return (
    <tr
      className={`border-t border-black/5 ${offer.selected ? "bg-emerald-50" : ""}`}
    >
      {showBrand && (
        <td className="py-2 pr-2 text-xs">
          {offer.brandName}
          {offer.brand && (
            <span className="text-text-muted"> · {offer.brand}</span>
          )}
          {offer.jarSize > 0 && (
            <span className="text-text-muted whitespace-nowrap">
              {" "}
              · {offer.jarSize} ct
            </span>
          )}
        </td>
      )}
      <td className="py-2 pr-2 font-medium">{offer.retailerName}</td>
      <td className="py-2 pr-2">
        {editingLink ? (
          <input
            type="text"
            autoFocus
            defaultValue={offer.url ?? ""}
            placeholder="Paste product URL"
            onBlur={(e) => commitLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitLink(e.currentTarget.value);
              if (e.key === "Escape") setEditingLink(false);
            }}
            className="w-40 px-2 py-1 text-xs border border-black/15 rounded-md bg-surface"
          />
        ) : offer.url ? (
          <span className="flex items-center gap-1.5">
            <a
              href={offer.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 font-semibold text-xs hover:underline whitespace-nowrap"
            >
              Check Site ↗
            </a>
            <button
              onClick={() => setEditingLink(true)}
              title="Edit link"
              className="text-text-muted hover:text-text text-xs"
            >
              ✎
            </button>
          </span>
        ) : (
          <button
            onClick={() => setEditingLink(true)}
            className="text-xs text-text-muted hover:text-emerald-700"
          >
            + Add link
          </button>
        )}
      </td>
      <td className="py-2 pr-2 text-right text-xs text-text-muted whitespace-nowrap">
        {offer.avgPrice !== null ? money(offer.avgPrice) : "—"}
      </td>
      <td className="py-2 pr-2 text-right">
        <input
          key={`${offer.supplementId}-${offer.retailerId}-${offer.enteredPrice}`}
          type="number"
          min="0"
          step="0.01"
          defaultValue={offer.enteredPrice ?? ""}
          placeholder="0.00"
          onBlur={(e) => {
            const raw = e.target.value.trim();
            const v = raw === "" ? null : parseFloat(raw);
            const next = v !== null && Number.isFinite(v) && v >= 0 ? v : null;
            if (next !== offer.enteredPrice) {
              setPrice({
                id: item._id,
                supplementId: offer.supplementId,
                retailerId: offer.retailerId,
                price: next,
              });
            }
          }}
          className="w-20 px-2 py-1 text-sm border border-black/15 rounded-md bg-surface text-right"
        />
      </td>
      <td className="py-2 pr-2 text-right text-xs whitespace-nowrap">
        {(() => {
          // Per-pill cost makes different bottle sizes comparable — the
          // entered price when present, otherwise the average (marked).
          const basis = offer.enteredPrice ?? offer.avgPrice;
          if (basis === null || offer.jarSize <= 0)
            return <span className="text-text-muted">—</span>;
          const isAvg = offer.enteredPrice === null;
          return (
            <span
              className={isAvg ? "text-text-muted" : "font-semibold"}
              title={isAvg ? "Based on average past price" : undefined}
            >
              {perPill(basis / offer.jarSize)}
              {isAvg && <span className="text-[10px]"> avg</span>}
            </span>
          );
        })()}
      </td>
      <td className="py-2 text-center">
        <button
          onClick={() =>
            selectOffer(
              offer.selected
                ? { id: item._id, supplementId: null, retailerId: null }
                : {
                    id: item._id,
                    supplementId: offer.supplementId,
                    retailerId: offer.retailerId,
                  }
            )
          }
          title={offer.selected ? "Deselect" : "Buy from this retailer"}
          className={`w-5 h-5 rounded-full border-2 inline-flex items-center justify-center transition-colors ${
            offer.selected
              ? "border-emerald-600 bg-emerald-600"
              : "border-black/20 hover:border-emerald-600"
          }`}
        >
          {offer.selected && (
            <span className="w-2 h-2 rounded-full bg-white" />
          )}
        </button>
      </td>
    </tr>
  );
}

function OrderCard({
  retailer,
  lines,
  onEdit,
  onPurchase,
}: {
  retailer: Retailer;
  lines: { item: PlanItem; offer: Offer }[];
  onEdit: () => void;
  onPurchase: () => void;
}) {
  const subtotal = lines.reduce(
    (sum, { item, offer }) => sum + item.qty * (offer.enteredPrice ?? 0),
    0
  );
  const missingPrices = lines.filter(
    ({ offer }) => offer.enteredPrice === null
  ).length;
  const threshold = retailer.freeShippingThreshold;
  const gap = threshold !== undefined ? threshold - subtotal : null;

  return (
    <div className="bg-surface border border-black/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">{retailer.name}</h3>
        <button
          onClick={onEdit}
          title="Edit retailer"
          className="text-text-muted hover:text-text text-xs"
        >
          ✎
        </button>
      </div>

      <ul className="space-y-1.5">
        {lines.map(({ item, offer }) => (
          <li
            key={item._id}
            className="flex justify-between gap-2 text-xs"
          >
            <span className="truncate">
              {item.name}
              {offer.brandName !== item.name && (
                <span className="text-text-muted"> ({offer.brandName})</span>
              )}{" "}
              × {item.qty}
            </span>
            <span className="whitespace-nowrap font-medium">
              {offer.enteredPrice !== null
                ? money(item.qty * offer.enteredPrice)
                : "no price"}
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t border-black/7 pt-2 flex justify-between text-sm font-bold">
        <span>Subtotal</span>
        <span>{money(subtotal)}</span>
      </div>

      {threshold === undefined ? (
        <button
          onClick={onEdit}
          className="text-[11px] text-text-muted hover:text-emerald-700"
        >
          Free-shipping threshold not set — add one
        </button>
      ) : gap !== null && gap > 0 ? (
        <div>
          <p className="text-[11px] text-amber-600 font-semibold">
            {money(gap)} away from free shipping ({money(threshold)})
          </p>
          <div className="mt-1 h-1.5 bg-black/8 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full"
              style={{
                width: `${Math.min(100, (subtotal / threshold) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-emerald-700 font-semibold">
          ✓ Free shipping ({money(threshold)} threshold met)
        </p>
      )}

      {missingPrices > 0 && (
        <p className="text-[11px] text-text-muted">
          {missingPrices} item{missingPrices === 1 ? "" : "s"} missing a price
          — subtotal is incomplete.
        </p>
      )}

      <button
        onClick={onPurchase}
        className="w-full px-3 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
      >
        Mark as Purchased
      </button>
    </div>
  );
}
