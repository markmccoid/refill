"use client";

// Shared "add a bottle" fields, used by both the Add Supplement screen and the
// supplement detail screen so the two entry points stay identical.
export interface BottleFieldsValue {
  count: number;
  price: number;
  purchaseUrl: string;
  purchasedAt: string; // yyyy-mm-dd
}

export function BottleFields({
  value,
  onChange,
  quantity,
  onQuantityChange,
}: {
  value: BottleFieldsValue;
  onChange: (v: BottleFieldsValue) => void;
  // When set, shows a "number of bottles" stepper: buying 2–3 identical
  // bottles in one order logs them without re-entering each one.
  quantity?: number;
  onQuantityChange?: (n: number) => void;
}) {
  const set = (patch: Partial<BottleFieldsValue>) =>
    onChange({ ...value, ...patch });

  const setQuantity = (n: number) =>
    onQuantityChange?.(Math.max(1, Math.min(99, n)));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-text-label font-semibold">
          Count
          <input
            type="number"
            min="1"
            value={value.count || ""}
            onChange={(e) =>
              set({ count: Math.max(0, parseInt(e.target.value) || 0) })
            }
            className="w-full mt-1 px-2 py-1.5 border border-border-strong rounded-lg font-mono text-sm"
          />
        </label>
        <label className="text-xs text-text-label font-semibold">
          Price
          <input
            type="number"
            min="0"
            step="0.01"
            value={value.price || ""}
            onChange={(e) =>
              set({ price: parseFloat(e.target.value) || 0 })
            }
            className="w-full mt-1 px-2 py-1.5 border border-border-strong rounded-lg font-mono text-sm"
          />
        </label>
        <label className="text-xs text-text-label font-semibold">
          Available date
          <input
            type="date"
            value={value.purchasedAt}
            onChange={(e) => set({ purchasedAt: e.target.value })}
            className="w-full mt-1 px-2 py-1.5 border border-border-strong rounded-lg text-sm"
          />
          <p className="mt-1 text-[11px] font-normal text-text-muted">
            Future dates are incoming and will not be used until then.
          </p>
        </label>
      </div>
      <label className="text-xs text-text-label font-semibold block">
        Purchase link (where you bought it)
        <input
          type="url"
          placeholder="https://store.com/product"
          value={value.purchaseUrl}
          onChange={(e) => set({ purchaseUrl: e.target.value })}
          className="w-full mt-1 px-2 py-1.5 border border-border-strong rounded-lg font-mono text-sm"
        />
      </label>
      {quantity !== undefined && onQuantityChange && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-label font-semibold">
            Number of bottles
            <span className="font-normal text-text-muted">
              {" "}
              (same price &amp; store)
            </span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setQuantity(quantity - 1)}
              disabled={quantity <= 1}
              aria-label="One less bottle"
              className="w-8 h-8 border border-border-strong rounded-lg text-lg leading-none hover:bg-surface-alt disabled:opacity-40"
            >
              −
            </button>
            <input
              type="number"
              min="1"
              max="99"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              aria-label="Number of bottles"
              className="w-14 px-2 py-1.5 border border-border-strong rounded-lg font-mono text-sm text-center"
            />
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              aria-label="One more bottle"
              className="w-8 h-8 border border-border-strong rounded-lg text-lg leading-none hover:bg-surface-alt"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
