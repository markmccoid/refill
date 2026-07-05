"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export interface PurchaseLineInput {
  itemId: Id<"restockItems">;
  itemName: string;
  brandName: string; // the selected brand (differs from itemName for groups)
  defaultQty: number;
  defaultPrice: number | null; // entered price, falling back to average
  defaultCount: number; // the brand's jarSize
}

interface LineState {
  include: boolean;
  qty: string;
  price: string;
  count: string;
}

const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * The Mark-as-Purchased confirmation (Q7): one retailer order at a time, with
 * actuals editable per line — checkout coupons change prices, sales change
 * counts, out-of-stock lines get unchecked and stay on the plan. Confirming
 * lands each unit as an individual bottle row via restock.markPurchased.
 */
export function PurchaseDialog({
  retailerId,
  retailerName,
  lines,
  onClose,
}: {
  retailerId: Id<"retailers">;
  retailerName: string;
  lines: PurchaseLineInput[];
  onClose: () => void;
}) {
  const markPurchased = useMutation(api.restock.markPurchased);

  const [state, setState] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(
      lines.map((l) => [
        l.itemId,
        {
          include: true,
          qty: String(l.defaultQty),
          price: l.defaultPrice !== null ? l.defaultPrice.toFixed(2) : "",
          count: String(l.defaultCount),
        },
      ])
    )
  );
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [busy, setBusy] = useState(false);

  const patch = (id: string, p: Partial<LineState>) =>
    setState((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));

  const included = lines.filter((l) => state[l.itemId]?.include);
  const parsed = included.map((l) => {
    const s = state[l.itemId];
    return {
      line: l,
      qty: parseInt(s.qty, 10),
      price: parseFloat(s.price),
      count: parseInt(s.count, 10),
    };
  });
  const valid =
    included.length > 0 &&
    parsed.every(
      (p) =>
        Number.isFinite(p.qty) &&
        p.qty >= 1 &&
        Number.isFinite(p.price) &&
        p.price >= 0 &&
        Number.isFinite(p.count) &&
        p.count >= 1
    );
  const total = parsed.reduce(
    (sum, p) =>
      sum + (Number.isFinite(p.qty) && Number.isFinite(p.price) ? p.qty * p.price : 0),
    0
  );

  const confirm = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await markPurchased({
        retailerId,
        purchasedAt: new Date(`${date}T12:00:00`).getTime(),
        lines: parsed.map((p) => ({
          itemId: p.line.itemId,
          qty: p.qty,
          pricePerBottle: p.price,
          countPerBottle: p.count,
        })),
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
        className="bg-surface rounded-xl shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-3 border-b border-border">
          <h2 className="text-lg font-bold">
            Mark purchased at {retailerName}
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Adjust anything that differed at checkout. Unchecked items stay on
            the plan. Each bottle is logged individually.
          </p>
        </div>

        <div className="flex-1 overflow-auto px-6 py-3 space-y-3">
          {lines.map((l) => {
            const s = state[l.itemId];
            const lineTotal =
              parseInt(s.qty, 10) * parseFloat(s.price) || 0;
            return (
              <div
                key={l.itemId}
                className={`border rounded-lg p-3 ${
                  s.include ? "border-border-strong" : "border-border opacity-50"
                }`}
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s.include}
                    onChange={(e) =>
                      patch(l.itemId, { include: e.target.checked })
                    }
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm font-semibold flex-1">
                    {l.itemName}
                    {l.brandName !== l.itemName && (
                      <span className="font-normal text-text-muted">
                        {" "}
                        — {l.brandName}
                      </span>
                    )}
                  </span>
                  {s.include && (
                    <span className="text-sm font-semibold">
                      {money(lineTotal)}
                    </span>
                  )}
                </label>
                {s.include && (
                  <div className="grid grid-cols-3 gap-2 mt-2 pl-6">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-text-muted">
                        Bottles
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={s.qty}
                        onChange={(e) => patch(l.itemId, { qty: e.target.value })}
                        className="mt-0.5 w-full px-2 py-1.5 text-sm border border-border-strong rounded-md bg-surface"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-text-muted">
                        Price / bottle
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={s.price}
                        onChange={(e) =>
                          patch(l.itemId, { price: e.target.value })
                        }
                        className="mt-0.5 w-full px-2 py-1.5 text-sm border border-border-strong rounded-md bg-surface"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-text-muted">
                        Pills / bottle
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={s.count}
                        onChange={(e) =>
                          patch(l.itemId, { count: e.target.value })
                        }
                        className="mt-0.5 w-full px-2 py-1.5 text-sm border border-border-strong rounded-md bg-surface"
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-xs font-semibold text-text-muted">
              Purchased
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-2 py-1.5 text-sm border border-border-strong rounded-md bg-surface"
            />
          </label>
          <span className="flex-1 text-right text-sm font-bold">
            Total {money(total)}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!valid || busy}
            className="px-4 py-2 text-sm font-semibold bg-primary hover:bg-primary-dark text-white rounded-lg disabled:opacity-50"
          >
            {busy ? "Recording…" : "Confirm purchase"}
          </button>
        </div>
      </div>
    </div>
  );
}
