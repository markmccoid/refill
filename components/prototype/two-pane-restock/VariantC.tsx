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
  updateItemSelection,
  useRestockPrototypeState,
  type MockPlanItem,
} from "./shared";

export const variantName = "Linked panes";

/** Selecting a retailer chip spotlights its basket; basket click scrolls back to items. */
export function VariantC() {
  const { items, setItems, baskets, lowestPill, cheapest, unassigned } =
    useRestockPrototypeState();
  const [focusedRetailerId, setFocusedRetailerId] = useState<string | null>(null);

  const handleSelectCandidate = (item: MockPlanItem, candidateId: string) => {
    setItems(updateItemSelection(items, item.id, candidateId));
    const c = item.candidates.find((x) => x.id === candidateId);
    if (c) setFocusedRetailerId(c.retailerId);
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
          Variant C — Linked panes
        </p>
        <p className="text-sm text-text-muted">
          Split view with cross-highlighting: picking a retailer chip focuses its basket on the
          right; clicking a basket refocuses the left list. Cheapest-all-in callout floats between
          panes.
        </p>
      </header>

      {cheapest.size > 0 && (
        <div className="rounded-lg border border-primary/40 bg-primary-light/20 px-4 py-2 text-sm">
          <span className="font-semibold text-primary">Cheapest all-in: </span>
          {[...cheapest]
            .map((id) => retailerName(id))
            .join(", ")}{" "}
          — compare complete baskets with known shipping only.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start min-h-[32rem]">
        <section className="space-y-3 overflow-auto max-h-[70vh] pr-1">
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-muted">
            Plan items
          </h2>
          {items.map((item) => {
            const sel = selectedCandidate(item);
            const itemRetailerFocus = sel?.retailerId === focusedRetailerId;
            return (
              <article
                key={item.id}
                className={`rounded-xl border p-4 space-y-3 transition-shadow ${
                  itemRetailerFocus && focusedRetailerId
                    ? "border-primary shadow-md shadow-primary/10"
                    : "border-border-strong bg-surface"
                }`}
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm">{item.subjectName}</h3>
                    <p className="text-[11px] text-text-muted">
                      {item.onHand} on hand · {item.daysLeft}d · qty {item.qty}
                    </p>
                  </div>
                  <button type="button" className="text-[11px] text-primary font-semibold">
                    Manage
                  </button>
                </div>

                {sel ? (
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-sm">
                    <p className="truncate text-xs">{sel.label}</p>
                    <input
                      type="number"
                      step={0.01}
                      defaultValue={itemPrice(item, sel.id) ?? ""}
                      placeholder="$"
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        setItems(
                          updateItemPrice(
                            items,
                            item.id,
                            sel.id,
                            Number.isFinite(v) ? v : null
                          )
                        );
                      }}
                      className="w-16 px-1.5 py-1 text-xs border border-border-strong rounded text-right"
                    />
                    <a
                      href={sel.url}
                      className="text-[11px] font-semibold text-primary whitespace-nowrap"
                    >
                      Check ↗
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">No option selected</p>
                )}

                <div className="flex flex-wrap gap-1">
                  {item.candidates.map((c) => {
                    const price = itemPrice(item, c.id);
                    const isLow = lowestPill.get(item.id)?.has(c.id);
                    const isSel = item.selectedCandidateId === c.id;
                    const isFocus = c.retailerId === focusedRetailerId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCandidate(item, c.id)}
                        className={`text-[11px] px-2 py-1 rounded-md border transition-all ${
                          isSel
                            ? "border-primary bg-primary text-white font-semibold"
                            : isFocus
                              ? "border-primary bg-primary-light/30"
                              : "border-border text-text-muted"
                        }`}
                      >
                        {retailerName(c.retailerId)}
                        {price !== null && c.count ? ` ${perPill(price, c.count)}` : ""}
                        {isLow && " ★"}
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>

        <section className="space-y-3 overflow-auto max-h-[70vh]">
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-muted">
            Baskets
          </h2>
          {baskets.map((b) => {
            const focused = b.retailer.id === focusedRetailerId;
            const isCheap = cheapest.has(b.retailer.id);
            return (
              <button
                key={b.retailer.id}
                type="button"
                onClick={() =>
                  setFocusedRetailerId(focused ? null : b.retailer.id)
                }
                className={`w-full text-left rounded-xl border p-4 space-y-3 transition-all ${
                  focused
                    ? "border-primary ring-2 ring-primary/25 scale-[1.01]"
                    : isCheap
                      ? "border-primary/50"
                      : "border-border-strong bg-surface"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">{b.retailer.name}</h3>
                  <div className="flex gap-1">
                    {isCheap && (
                      <span className="text-[10px] font-bold uppercase text-primary">
                        Cheapest
                      </span>
                    )}
                    {b.allIn !== null && (
                      <span className="text-sm font-bold">{money(b.allIn)}</span>
                    )}
                  </div>
                </div>
                <ul className="space-y-1 text-xs">
                  {b.lines.map(({ item, lineTotal }) => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span className="truncate">{item.subjectName}</span>
                      <span>{lineTotal !== null ? money(lineTotal) : "—"}</span>
                    </li>
                  ))}
                </ul>
                <BasketTotals basket={b} />
                <ShippingStatus basket={b} />
              </button>
            );
          })}
          {unassigned > 0 && (
            <p className="text-xs text-text-muted px-1">
              {unassigned} item(s) still need a retailer option.
            </p>
          )}
        </section>
      </div>

      <div className="flex gap-2 flex-wrap">
        {baskets.map((b) => (
          <button
            key={b.retailer.id}
            type="button"
            onClick={() => setFocusedRetailerId(b.retailer.id)}
            className="text-xs px-3 py-1.5 rounded-full border border-border-strong hover:border-primary"
          >
            Jump to {b.retailer.name}
          </button>
        ))}
      </div>

      <StateDump items={items} baskets={baskets} cheapest={cheapest} />
    </div>
  );
}
