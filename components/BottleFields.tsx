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
}: {
  value: BottleFieldsValue;
  onChange: (v: BottleFieldsValue) => void;
}) {
  const set = (patch: Partial<BottleFieldsValue>) =>
    onChange({ ...value, ...patch });

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
            className="w-full mt-1 px-2 py-1.5 border border-black/16 rounded-lg font-mono text-sm"
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
            className="w-full mt-1 px-2 py-1.5 border border-black/16 rounded-lg font-mono text-sm"
          />
        </label>
        <label className="text-xs text-text-label font-semibold">
          Purchased
          <input
            type="date"
            value={value.purchasedAt}
            onChange={(e) => set({ purchasedAt: e.target.value })}
            className="w-full mt-1 px-2 py-1.5 border border-black/16 rounded-lg text-sm"
          />
        </label>
      </div>
      <label className="text-xs text-text-label font-semibold block">
        Purchase link (where you bought it)
        <input
          type="url"
          placeholder="https://store.com/product"
          value={value.purchaseUrl}
          onChange={(e) => set({ purchaseUrl: e.target.value })}
          className="w-full mt-1 px-2 py-1.5 border border-black/16 rounded-lg font-mono text-sm"
        />
      </label>
    </div>
  );
}
