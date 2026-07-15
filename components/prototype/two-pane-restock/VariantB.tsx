"use client";

import { useState } from "react";
import {
  BasketTotals,
  itemPrice,
  money,
  perPill,
  retailerName,
  selectedCandidate,
  ShippingStatus,
  StateDump,
  updateItemPrice,
  updateItemQty,
  updateItemSelection,
  useRestockPrototypeState,
  type MockPlanItem,
} from "./shared";

export const variantName = "Retailer tabs";

/** Retailer is primary navigation — tabs show all-in preview; main pane is one basket at a time. */
export function VariantB() {
  const { items, setItems, baskets, lowestPill, cheapest, unassigned } =
    useRestockPrototypeState();
  const [activeRetailerId, setActiveRetailerId] = useState(
    () => baskets[0]?.retailer.id ?? "all"
  );

  const activeBasket = baskets.find((b) => b.retailer.id === activeRetailerId);
  const itemsForActive =
    activeRetailerId === "all"
      ? items
      : items.filter((i) => selectedCandidate(i)?.retailerId === activeRetailerId);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
          Variant B — Retailer tabs
        </p>
        <p className="text-sm text-text-muted">
          Navigate by where you&apos;re buying. Tabs show all-in totals; the main area focuses on
          one retailer&apos;s basket and only its assigned items.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <TabButton
          active={activeRetailerId === "all"}
          onClick={() => setActiveRetailerId("all")}
          label="All items"
          sub={`${items.length} in plan`}
        />
        {baskets.map((b) => (
          <TabButton
            key={b.retailer.id}
            active={activeRetailerId === b.retailer.id}
            onClick={() => setActiveRetailerId(b.retailer.id)}
            label={b.retailer.name}
            sub={
              b.allIn !== null
                ? `${money(b.allIn)} all-in`
                : b.complete
                  ? "…"
                  : "incomplete"
            }
            highlight={cheapest.has(b.retailer.id)}
          />
        ))}
        {unassigned > 0 && (
          <span className="self-center text-xs text-text-muted ml-2">
            {unassigned} unassigned
          </span>
        )}
      </div>

      {activeRetailerId !== "all" && activeBasket ? (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-3">
            <h2 className="text-sm font-bold">
              Items at {activeBasket.retailer.name}
            </h2>
            {itemsForActive.map((item) => (
              <CompactItemRow
                key={item.id}
                item={item}
                lowestIds={lowestPill.get(item.id) ?? new Set()}
                onSelect={(cid) => setItems(updateItemSelection(items, item.id, cid))}
                onPrice={(cid, p) => setItems(updateItemPrice(items, item.id, cid, p))}
                onQty={(q) => setItems(updateItemQty(items, item.id, q))}
              />
            ))}
          </div>
          <div className="lg:col-span-2">
            <div
              className={`bg-surface border rounded-xl p-5 space-y-4 sticky top-4 ${
                cheapest.has(activeBasket.retailer.id)
                  ? "border-primary ring-1 ring-primary/30"
                  : "border-border-strong"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{activeBasket.retailer.name} order</h3>
                {cheapest.has(activeBasket.retailer.id) && (
                  <span className="text-[10px] font-bold uppercase text-primary">
                    Cheapest all-in
                  </span>
                )}
              </div>
              <ul className="space-y-2">
                {activeBasket.lines.map(({ item, candidate, lineTotal, perPill: pp }) => (
                  <li key={item.id} className="text-sm border-b border-border pb-2">
                    <p className="font-medium">{item.subjectName}</p>
                    <p className="text-xs text-text-muted truncate">{candidate.label}</p>
                    <div className="flex justify-between mt-1 text-xs">
                      <span>
                        × {item.qty}
                        {pp && ` · ${pp}/pill`}
                      </span>
                      <span className="font-semibold">
                        {lineTotal !== null ? money(lineTotal) : "no price"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <BasketTotals basket={activeBasket} />
              <ShippingStatus basket={activeBasket} />
              <button
                type="button"
                className="w-full py-2.5 text-sm font-semibold bg-primary text-white rounded-lg"
              >
                Mark as Purchased at {activeBasket.retailer.name}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            Pick a retailer tab to focus a basket, or assign options below.
          </p>
          {items.map((item) => (
            <CompactItemRow
              key={item.id}
              item={item}
              lowestIds={lowestPill.get(item.id) ?? new Set()}
              onSelect={(cid) => {
                setItems(updateItemSelection(items, item.id, cid));
                const c = item.candidates.find((x) => x.id === cid);
                if (c) setActiveRetailerId(c.retailerId);
              }}
              onPrice={(cid, p) => setItems(updateItemPrice(items, item.id, cid, p))}
              onQty={(q) => setItems(updateItemQty(items, item.id, q))}
            />
          ))}
        </div>
      )}

      <StateDump items={items} baskets={baskets} cheapest={cheapest} />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  sub,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-left border transition-colors ${
        active
          ? "border-primary bg-primary-light/30"
          : "border-border-strong hover:border-primary/40"
      } ${highlight && !active ? "ring-1 ring-primary/20" : ""}`}
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-[11px] text-text-muted">{sub}</p>
    </button>
  );
}

function CompactItemRow({
  item,
  lowestIds,
  onSelect,
  onPrice,
  onQty,
}: {
  item: MockPlanItem;
  lowestIds: Set<string>;
  onSelect: (candidateId: string) => void;
  onPrice: (candidateId: string, price: number | null) => void;
  onQty: (qty: number) => void;
}) {
  const selected = selectedCandidate(item);
  const selectedPrice = selected ? itemPrice(item, selected.id) : null;

  return (
    <div className="bg-surface border border-border rounded-lg px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-semibold text-sm">{item.subjectName}</span>
          <span className="text-xs text-text-muted ml-2">{item.daysLeft}d</span>
        </div>
        <input
          type="number"
          min={1}
          defaultValue={item.qty}
          onBlur={(e) => {
            const v = parseInt(e.target.value, 10);
            if (Number.isFinite(v) && v >= 1) onQty(v);
          }}
          className="w-12 px-1.5 py-0.5 text-xs border border-border-strong rounded text-center"
          title="Bottles"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {item.candidates.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className={`text-[11px] px-2 py-0.5 rounded-full border ${
              item.selectedCandidateId === c.id
                ? "border-primary bg-primary-light/40 font-semibold"
                : "border-border text-text-muted"
            }`}
          >
            {retailerName(c.retailerId)}
            {lowestIds.has(c.id) && " ★"}
          </button>
        ))}
      </div>
      {selected && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-text-muted truncate max-w-[14rem]">{selected.label}</span>
          <input
            type="number"
            step={0.01}
            placeholder="Price"
            defaultValue={selectedPrice ?? ""}
            onBlur={(e) => {
              const v = parseFloat(e.target.value);
              onPrice(selected.id, Number.isFinite(v) ? v : null);
            }}
            className="w-16 px-1.5 py-0.5 border border-border-strong rounded text-right"
          />
          {selected.count && selectedPrice !== null && (
            <span className="font-medium">{perPill(selectedPrice, selected.count)}/pill</span>
          )}
          <a href={selected.url} className="text-primary font-semibold">
            Check Site ↗
          </a>
        </div>
      )}
    </div>
  );
}
