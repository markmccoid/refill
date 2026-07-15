"use client";

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
import type { RetailerBasket } from "./basket-math";
import { retailerAccent } from "./retailer-colors";

export const variantName = "Items + sidebar baskets";

/** Evolved ADR-0006 layout: item cards (selected + chips) left, sticky retailer baskets right. */
export function VariantA() {
  const { items, setItems, baskets, lowestPill, cheapest, unassigned } =
    useRestockPrototypeState();

  return (
    <div className="space-y-4">
      <PrototypeHeader
        title="Variant A — Items + sidebar baskets"
        blurb="Same 2/3 + 1/3 grid as today's Restock page. Item cards use selected row + retailer chips (ticket 03). Each retailer gets a distinct accent color linking chips, selected row, and basket card."
      />

      <div className="grid gap-6 xl:grid-cols-3 items-start">
        <div className="xl:col-span-2 space-y-4">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              lowestIds={lowestPill.get(item.id) ?? new Set()}
              onSelect={(cid) => setItems(updateItemSelection(items, item.id, cid))}
              onPrice={(cid, p) => setItems(updateItemPrice(items, item.id, cid, p))}
              onQty={(q) => setItems(updateItemQty(items, item.id, q))}
            />
          ))}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-muted">
            Retailer baskets
          </h2>
          {baskets.length === 0 ? (
            <EmptyBaskets />
          ) : (
            baskets.map((b) => (
              <SidebarBasket
                key={b.retailer.id}
                basket={b}
                isCheapest={cheapest.has(b.retailer.id)}
              />
            ))
          )}
          {unassigned > 0 && (
            <p className="text-xs text-text-muted">
              {unassigned} item{unassigned === 1 ? "" : "s"} without a retailer selected.
            </p>
          )}
        </aside>
      </div>

      <StateDump items={items} baskets={baskets} cheapest={cheapest} />
    </div>
  );
}

function ItemCard({
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
  const selectedAccent = selected ? retailerAccent(selected.retailerId) : null;

  return (
    <article className="bg-surface border border-border-strong rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold">{item.subjectName}</h3>
            {item.subjectKind === "group" && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-primary-light text-primary px-1.5 py-0.5 rounded">
                Group
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            {item.onHand} on hand ·{" "}
            <span className={item.daysLeft <= 14 ? "text-red-600 font-semibold" : ""}>
              {item.daysLeft}d left
            </span>
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          Bottles
          <input
            type="number"
            min={1}
            defaultValue={item.qty}
            onBlur={(e) => {
              const v = parseInt(e.target.value, 10);
              if (Number.isFinite(v) && v >= 1) onQty(v);
            }}
            className="w-14 px-2 py-1 text-sm border border-border-strong rounded-md text-center"
          />
          <span>(suggested {item.recommendedQty})</span>
        </label>
      </div>

      {selected && selectedAccent ? (
        <div
          className={`rounded-lg border border-l-4 px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 ${selectedAccent.selectedRow}`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{selected.label}</p>
            <p className="text-xs text-text-muted">{retailerName(selected.retailerId)}</p>
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
            type="number"
            min={0}
            step={0.01}
            placeholder="Price"
            defaultValue={selectedPrice ?? ""}
            onBlur={(e) => {
              const raw = e.target.value.trim();
              const v = raw === "" ? null : parseFloat(raw);
              onPrice(
                selected.id,
                v !== null && Number.isFinite(v) && v >= 0 ? v : null
              );
            }}
            className="w-20 px-2 py-1 text-sm border border-border-strong rounded-md text-right"
          />
          {selected.count && selectedPrice !== null && (
            <span className="text-xs font-semibold whitespace-nowrap">
              {perPill(selectedPrice, selected.count)}/pill
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
          const isSelected = item.selectedCandidateId === c.id;
          const price = itemPrice(item, c.id);
          const isLowest = lowestIds.has(c.id);
          const accent = retailerAccent(c.retailerId);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                isSelected
                  ? accent.chipSelected
                  : "border-border text-text-muted hover:border-text-muted"
              }`}
            >
              {retailerName(c.retailerId)}
              {price !== null && c.count ? ` · ${perPill(price, c.count)}` : ""}
              {isLowest && (
                <span className="ml-1 text-primary" title="Lowest $/pill among priced options">
                  ★
                </span>
              )}
            </button>
          );
        })}
        <button type="button" className="text-[11px] text-primary font-semibold px-1">
          Manage options
        </button>
      </div>
    </article>
  );
}

function SidebarBasket({
  basket,
  isCheapest,
}: {
  basket: RetailerBasket;
  isCheapest: boolean;
}) {
  const accent = retailerAccent(basket.retailer.id);

  return (
    <div
      className={`bg-surface border border-border-strong border-l-4 rounded-xl p-4 space-y-3 ${accent.basketBorder} ${
        isCheapest ? `ring-2 ${accent.basketRing}` : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-sm">{basket.retailer.name}</h3>
        {isCheapest && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary-light px-1.5 py-0.5 rounded">
            Cheapest all-in
          </span>
        )}
      </div>

      <ul className="space-y-1.5">
        {basket.lines.map(({ item, candidate, lineTotal }) => (
          <li key={item.id} className="flex justify-between gap-2 text-xs">
            <span className="truncate">
              {item.subjectName}{" "}
              <span className="text-text-muted">({candidate.label.split(" ").slice(0, 2).join(" ")}…)</span>{" "}
              × {item.qty}
            </span>
            <span className="font-medium whitespace-nowrap">
              {lineTotal !== null ? money(lineTotal) : "no price"}
            </span>
          </li>
        ))}
      </ul>

      <BasketTotals basket={basket} />
      <ShippingStatus basket={basket} />

      <button
        type="button"
        className="w-full px-3 py-2 text-sm font-semibold bg-primary hover:bg-primary-dark text-white rounded-lg"
      >
        Mark as Purchased
      </button>
    </div>
  );
}

function EmptyBaskets() {
  return (
    <div className="border border-dashed border-border-strong rounded-xl p-6 text-center text-xs text-text-muted">
      Select a retailer option on an item to start a basket.
    </div>
  );
}

function PrototypeHeader({ title, blurb }: { title: string; blurb: string }) {
  return (
    <header className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-wide text-amber-700">{title}</p>
      <p className="text-sm text-text-muted">{blurb}</p>
    </header>
  );
}

export { PrototypeHeader, EmptyBaskets, SidebarBasket, ItemCard };
